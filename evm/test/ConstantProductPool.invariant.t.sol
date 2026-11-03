// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.38;

import {CommonBase} from "forge-std/Base.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {ConstantProductPool} from "../src/ConstantProductPool.sol";
import {TestToken} from "./TestToken.sol";

/// Trades with the pool as several people, in whatever order the fuzzer picks,
/// among tokens sent to the pool directly. It judges whether each swap should
/// go through, and what it paid, moved and logged. What the pool gets wrong is
/// recorded in a flag for an invariant to assert, and `fail_on_revert` fails
/// the campaign if this contract reverts.
contract Trader is CommonBase, StdUtils {
    ConstantProductPool pool;
    TestToken gold;
    TestToken silver;
    address[] actors;
    uint256 maxTrade;

    /// A copy of the pool's event, so that changing the pool's fails the tests.
    event Swap(
        address indexed trader,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut
    );

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
    /// Whether a swap logged anything but one event saying what it did.
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
        maxTrade = maxTrade_;
        lastProduct = pool.reserve0() * pool.reserve1();
    }

    /// What a swap can change, from the side of the token paid in and the
    /// token paid out.
    struct Books {
        uint256 reserveIn;
        uint256 reserveOut;
        uint256 balanceIn;
        uint256 balanceOut;
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

    function swap(
        bool zeroForOne,
        uint256 amountIn,
        uint8 minimumKind,
        uint8 fundingKind,
        uint8 who
    ) external {
        amountIn = bound(amountIn, 1, maxTrade);
        address actor = actors[who % actors.length];
        TestToken tokenIn = zeroForOne ? gold : silver;

        // exactly what the swap costs, or a unit more with an unlimited
        // approval or one above that, so that a pool taking too much shows
        fundingKind %= 3;
        tokenIn.mint(actor, fundingKind == 0 ? amountIn : amountIn + 1);
        vm.prank(actor);
        tokenIn.approve(
            address(pool),
            [amountIn, type(uint256).max, amountIn + 2][fundingKind]
        );

        Books memory before = books(actor, zeroForOne);

        // no minimum, or one the model's output just meets or just misses
        uint256 output =
            before.reserveOut * amountIn / (before.reserveIn + amountIn);
        uint256 minimum = [uint256(0), output, output + 1][minimumKind % 3];
        bool pays = output > 0 && output >= minimum;

        vm.recordLogs();
        vm.prank(actor);
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
        // leave the actor with nothing, so the next swap starts from scratch
        uint256 left = tokenIn.balanceOf(actor);
        vm.prank(actor);
        tokenIn.transfer(address(0xdead), left);
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

    /// Tokens sent to the pool, which have to stay off its books.
    function donate(bool toGold, uint256 amount) external {
        amount = bound(amount, 1, maxTrade);
        (toGold ? gold : silver).mint(address(pool), amount);
        if (toGold) donatedGold += amount;
        else donatedSilver += amount;
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

    /// Whether the pool logged, since `recordLogs`, exactly one event, and
    /// that it says what the swap did.
    function logged(
        address actor,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut
    ) internal view returns (bool) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
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

/// Sequences on a small pool, with trades to match, where rounding matters.
contract ConstantProductPoolInvariantTest is Test {
    TestToken gold = new TestToken("Gold", "GLD");
    TestToken silver = new TestToken("Silver", "SLV");
    ConstantProductPool pool;
    Trader trader;

    function setUp() public {
        pool = new ConstantProductPool(gold, silver);
        gold.mint(address(this), 1000);
        silver.mint(address(this), 4000);
        gold.approve(address(pool), 1000);
        silver.approve(address(pool), 4000);
        pool.initialize(1000, 4000);

        // the owner trades too: the model knows no owner
        address[] memory actors = new address[](3);
        actors[0] = makeAddr("alice");
        actors[1] = makeAddr("bob");
        actors[2] = address(this);

        trader = new Trader(pool, gold, silver, actors, 2000);
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
