// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.38;

import {
    IERC20Errors
} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {CommonBase} from "forge-std/Base.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {ConstantProductPool} from "../src/ConstantProductPool.sol";
import {TestToken} from "./TestToken.sol";

/// Trades with the pool as several people, in whatever order the fuzzer picks,
/// among swaps that have to be refused and tokens sent to the pool directly. It
/// judges whether each swap should go through, and what it paid, moved and
/// logged. What the pool gets wrong is recorded in a flag for an invariant to
/// assert, and `fail_on_revert` fails the campaign if this contract reverts.
contract Trader is CommonBase, StdUtils {
    ConstantProductPool pool;
    TestToken gold;
    TestToken silver;
    address[] actors;
    uint256 maxTrade;

    /// Where a caller's tokens go when it has to start from nothing.
    address constant SINK = address(0xdead);

    /// A copy of the pool's event, so that changing the pool's fails the tests.
    event Swap(
        address indexed trader,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut
    );

    /// What a swap can change, from the side of the token paid in and the
    /// token paid out.
    struct Books {
        uint256 reserveIn;
        uint256 reserveOut;
        uint256 balanceIn;
        uint256 balanceOut;
    }

    /// The pool's product after the latest swap, and whether one lowered it.
    uint256 public lastProduct;
    bool public productDecreased;
    /// Whether the pool refused a swap the model accepts, or refused one for
    /// any reason but the right one.
    bool public wronglyRefused;
    /// Whether the pool let through a swap the model refuses.
    bool public wronglyPaid;
    /// Whether a swap paid anything but the largest output that keeps the
    /// product.
    bool public wrongOutput;
    /// Whether what a swap returned differs from what happened to the
    /// reserves or to the trader's tokens.
    bool public wrongBooks;
    /// Whether a swap logged anything but one event saying what it did and
    /// its two transfers.
    bool public wrongEvent;
    uint256 public swaps;
    uint256 public refusals;
    uint256 public donatedGold;
    uint256 public donatedSilver;

    constructor(
        ConstantProductPool pool_,
        TestToken gold_,
        TestToken silver_,
        address[] memory actors_,
        uint256 maxTrade_
    ) {
        pool = pool_;
        gold = gold_;
        silver = silver_;
        actors = actors_;
        // a caller that is a contract, and not the owner
        actors.push(address(this));
        maxTrade = maxTrade_;
        lastProduct = pool.reserve0() * pool.reserve1();
    }

    function books(address actor, bool zeroForOne)
        internal
        view
        returns (Books memory)
    {
        (TestToken tokenIn, TestToken tokenOut) =
            zeroForOne ? (gold, silver) : (silver, gold);
        (uint256 reserveIn, uint256 reserveOut) = zeroForOne
            ? (pool.reserve0(), pool.reserve1())
            : (pool.reserve1(), pool.reserve0());
        return Books({
            reserveIn: reserveIn,
            reserveOut: reserveOut,
            balanceIn: tokenIn.balanceOf(actor),
            balanceOut: tokenOut.balanceOf(actor)
        });
    }

    /// Leave `actor` holding exactly `balance` of `token`, and approving
    /// `approval` of it.
    function provide(
        address actor,
        TestToken token,
        uint256 balance,
        uint256 approval
    ) internal {
        uint256 held = token.balanceOf(actor);
        vm.prank(actor);
        token.transfer(SINK, held);
        token.mint(actor, balance);
        vm.prank(actor);
        token.approve(address(pool), approval);
    }

    /// Call as `actor`, from a wallet of its own or from behind another.
    function prank(address actor, uint8 who) internal {
        vm.prank(actor, who >= 128 ? actor : tx.origin);
    }

    /// What the model pays.
    function quote(Books memory before, uint256 amountIn)
        internal
        pure
        returns (uint256)
    {
        return before.reserveOut * amountIn / (before.reserveIn + amountIn);
    }

    function swap(
        bool zeroForOne,
        uint256 amountIn,
        uint8 minimumKind,
        uint8 fundingKind,
        uint8 who
    ) external {
        amountIn = bound(amountIn, 1, maxTrade);
        address actor = actors[who % actors.length];

        // exactly what the swap costs, a unit more, or an unlimited approval
        uint256 funds = amountIn + (fundingKind % 3 == 0 ? 0 : 1);
        provide(
            actor,
            zeroForOne ? gold : silver,
            funds,
            fundingKind % 3 == 2 ? type(uint256).max : funds
        );

        Books memory before = books(actor, zeroForOne);

        // no minimum, or one the model's output just meets or just misses
        uint256 output = quote(before, amountIn);
        uint256 minimum = [uint256(0), output, output + 1][minimumKind % 3];
        bool pays = output > 0 && output >= minimum;

        vm.recordLogs();
        prank(actor, who);
        try pool.swap(zeroForOne, amountIn, minimum) returns (
            uint256 amountOut
        ) {
            if (pays) {
                judge(actor, zeroForOne, amountIn, amountOut, before);
            } else {
                wronglyPaid = true;
            }
        } catch (bytes memory reason) {
            refusals++;
            if (
                pays
                    || bytes4(reason)
                        != ConstantProductPool.OutputTooSmall.selector
            ) wronglyRefused = true;
        }
    }

    /// A swap that has to be refused, for the reason given. The pool's own
    /// reasons come before any tokens move, so these callers hold nothing.
    function refuse(bool zeroForOne, uint256 amountIn, uint8 kind, uint8 who)
        external
    {
        amountIn = bound(amountIn, 1, maxTrade);
        address actor = actors[who % actors.length];
        TestToken tokenIn = zeroForOne ? gold : silver;
        uint256 output = quote(books(actor, zeroForOne), amountIn);

        uint256 minimum;
        bytes memory reason =
            abi.encodeWithSelector(ConstantProductPool.OutputTooSmall.selector);
        kind %= 4;
        if (kind == 0) {
            amountIn = 0;
            minimum = who % 2;
            reason = abi.encodeWithSelector(
                ConstantProductPool.AmountNotPositive.selector
            );
        } else if (kind == 1 || output == 0) {
            provide(actor, tokenIn, 0, 0);
            minimum = kind == 1 ? output + 1 : 0;
        } else if (kind == 2) {
            provide(actor, tokenIn, amountIn, amountIn - 1);
            reason = abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(pool),
                amountIn - 1,
                amountIn
            );
        } else {
            provide(actor, tokenIn, amountIn - 1, amountIn);
            reason = abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector,
                actor,
                amountIn - 1,
                amountIn
            );
        }

        prank(actor, who);
        try pool.swap(zeroForOne, amountIn, minimum) {
            wronglyPaid = true;
        } catch (bytes memory actual) {
            refusals++;
            if (keccak256(actual) != keccak256(reason)) wronglyRefused = true;
        }
    }

    /// Tokens sent to the pool, which have to stay off its books.
    function donate(bool toGold, uint256 amount) external {
        amount = bound(amount, 1, maxTrade);
        (toGold ? gold : silver).mint(address(pool), amount);
        if (toGold) donatedGold += amount;
        else donatedSilver += amount;
    }

    function judge(
        address actor,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut,
        Books memory before
    ) internal {
        swaps++;

        uint256 product = pool.reserve0() * pool.reserve1();
        if (product < lastProduct) productDecreased = true;
        lastProduct = product;

        if (!keepsTheProduct(
                before.reserveIn, before.reserveOut, amountIn, amountOut
            )) {
            wrongOutput = true;
            return;
        }
        if (!logged(actor, zeroForOne, amountIn, amountOut)) wrongEvent = true;

        Books memory afterwards = books(actor, zeroForOne);
        if (
            afterwards.reserveIn != before.reserveIn + amountIn
                || afterwards.reserveOut + amountOut != before.reserveOut
                || afterwards.balanceIn + amountIn != before.balanceIn
                || afterwards.balanceOut != before.balanceOut + amountOut
        ) wrongBooks = true;
    }

    /// The two-sided check of testFuzz_OutputIsTheLargestThatKeepsTheProduct.
    /// The first test keeps the subtractions below from reverting.
    function keepsTheProduct(
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 amountIn,
        uint256 amountOut
    ) internal pure returns (bool) {
        if (amountOut >= reserveOut) return false;
        uint256 product = reserveIn * reserveOut;
        uint256 grown = reserveIn + amountIn;
        return grown * (reserveOut - amountOut) >= product
            && grown * (reserveOut - amountOut - 1) < product;
    }

    /// Whether the logs since `recordLogs` are the swap's event and two others,
    /// which `judge` shows to be its transfers. Anything more, such as an
    /// approval by the pool, is wrong.
    function logged(
        address actor,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut
    ) internal returns (bool) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        if (logs.length != 3) return false;

        bytes32 data = keccak256(abi.encode(zeroForOne, amountIn, amountOut));
        uint256 found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter != address(pool)) continue;
            if (
                logs[i].topics.length != 2 || logs[i].topics[0] != Swap.selector
                    || logs[i].topics[1] != bytes32(uint256(uint160(actor)))
                    || keccak256(logs[i].data) != data
            ) return false;
            found++;
        }
        return found == 1;
    }
}

/// The invariants, and a pool for them to start from.
abstract contract PoolInvariants is Test {
    TestToken gold = new TestToken("Gold", "GLD");
    TestToken silver = new TestToken("Silver", "SLV");
    ConstantProductPool pool;
    Trader trader;

    function startingPool()
        internal
        pure
        virtual
        returns (uint256 goldAmount, uint256 silverAmount, uint256 maxTrade);

    /// Whether gold takes the lower address, which the other pools leave to
    /// the order the tokens were deployed in.
    function reversed() internal pure virtual returns (bool) {
        return false;
    }

    function setUp() public {
        (uint256 goldAmount, uint256 silverAmount, uint256 maxTrade) =
            startingPool();

        if (reversed()) (gold, silver) = (silver, gold);
        pool = new ConstantProductPool(gold, silver);
        gold.mint(address(this), goldAmount);
        silver.mint(address(this), silverAmount);
        gold.approve(address(pool), goldAmount);
        silver.approve(address(pool), silverAmount);
        pool.initialize(goldAmount, silverAmount);

        address[] memory actors = new address[](3);
        actors[0] = makeAddr("alice");
        actors[1] = makeAddr("bob");
        actors[2] = address(this);

        trader = new Trader(pool, gold, silver, actors, maxTrade);
        targetContract(address(trader));
    }

    function invariant_ReservesMatchBalances() public view {
        assertEq(
            pool.reserve0() + trader.donatedGold(),
            gold.balanceOf(address(pool))
        );
        assertEq(
            pool.reserve1() + trader.donatedSilver(),
            silver.balanceOf(address(pool))
        );
    }

    function invariant_ReservesStayPositive() public view {
        assertGt(pool.reserve0(), 0);
        assertGt(pool.reserve1(), 0);
    }

    function invariant_ProductNeverDecreases() public view {
        assertFalse(trader.productDecreased());
    }

    function invariant_SwapsThatPayGoThrough() public view {
        assertFalse(trader.wronglyRefused());
    }

    function invariant_SwapsThatDoNotPayAreRefused() public view {
        assertFalse(trader.wronglyPaid());
    }

    function invariant_OutputIsTheLargestThatKeepsTheProduct() public view {
        assertFalse(trader.wrongOutput());
    }

    function invariant_SwapsDoWhatTheyReturn() public view {
        assertFalse(trader.wrongBooks());
    }

    function invariant_SwapsLogWhatTheyDid() public view {
        assertFalse(trader.wrongEvent());
    }

    /// The checks above mean little unless swaps went through and were refused.
    /// A failure Foundry replays from its cache can be too short to show both.
    function afterInvariant() public view {
        if (trader.swaps() + trader.refusals() < 100) return;
        assertGt(trader.swaps(), 0);
        assertGt(trader.refusals(), 0);
    }
}

/// Sequences on a large pool, where rounding hardly matters.
contract LargePoolInvariantTest is PoolInvariants {
    function startingPool()
        internal
        pure
        override
        returns (uint256 goldAmount, uint256 silverAmount, uint256 maxTrade)
    {
        return (1e24, 4e24, 1e24);
    }
}

/// Sequences on a small pool, with trades to match, where rounding matters.
contract SmallPoolInvariantTest is PoolInvariants {
    function startingPool()
        internal
        pure
        override
        returns (uint256 goldAmount, uint256 silverAmount, uint256 maxTrade)
    {
        return (1000, 4000, 2000);
    }
}

/// The small pool again, with its tokens the other way round.
contract ReversedPoolInvariantTest is PoolInvariants {
    function startingPool()
        internal
        pure
        override
        returns (uint256 goldAmount, uint256 silverAmount, uint256 maxTrade)
    {
        return (1000, 4000, 2000);
    }

    function reversed() internal pure override returns (bool) {
        return true;
    }
}
