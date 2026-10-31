// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.38;

import {StdUtils} from "forge-std/StdUtils.sol";
import {Test} from "forge-std/Test.sol";
import {ConstantProductPool} from "../src/ConstantProductPool.sol";
import {TestToken} from "./TestToken.sol";

/// Trades with the pool in whatever order the fuzzer picks, judging every
/// swap. A revert out of `swap` would not fail the campaign, so whatever goes
/// wrong is recorded in a flag for an invariant to assert.
contract Trader is StdUtils {
    ConstantProductPool pool;
    TestToken gold;
    TestToken silver;
    uint256 maxTrade;

    /// The pool's product after the latest swap, and whether one lowered it.
    uint256 public lastProduct;
    bool public productDecreased;
    /// Whether the pool refused a swap that would have paid something.
    bool public wronglyRefused;
    /// Whether a swap paid anything but the largest output that keeps the
    /// product.
    bool public wrongOutput;
    /// Whether what a swap returned differs from what happened to the
    /// reserves or to the trader's tokens.
    bool public wrongBooks;
    uint256 public swaps;

    constructor(
        ConstantProductPool pool_,
        TestToken gold_,
        TestToken silver_,
        uint256 maxTrade_
    ) {
        pool = pool_;
        gold = gold_;
        silver = silver_;
        maxTrade = maxTrade_;
        lastProduct = pool.reserve0() * pool.reserve1();
    }

    function reserves(bool zeroForOne)
        internal
        view
        returns (uint256 reserveIn, uint256 reserveOut)
    {
        (reserveIn, reserveOut) = zeroForOne
            ? (pool.reserve0(), pool.reserve1())
            : (pool.reserve1(), pool.reserve0());
    }

    function swap(bool zeroForOne, uint256 amountIn) external {
        amountIn = bound(amountIn, 1, maxTrade);
        TestToken tokenIn = zeroForOne ? gold : silver;
        TestToken tokenOut = zeroForOne ? silver : gold;
        tokenIn.mint(address(this), amountIn);
        tokenIn.approve(address(pool), amountIn);

        (uint256 reserveIn, uint256 reserveOut) = reserves(zeroForOne);
        uint256 balanceIn = tokenIn.balanceOf(address(this));
        uint256 balanceOut = tokenOut.balanceOf(address(this));

        try pool.swap(zeroForOne, amountIn, 0) returns (uint256 amountOut) {
            swaps++;
            checkOutput(reserveIn, reserveOut, amountIn, amountOut);

            (uint256 nowIn, uint256 nowOut) = reserves(zeroForOne);
            if (
                nowIn != reserveIn + amountIn
                    || nowOut + amountOut != reserveOut
                    || tokenIn.balanceOf(address(this)) + amountIn != balanceIn
                    || tokenOut.balanceOf(address(this))
                        != balanceOut + amountOut
            ) wrongBooks = true;
        } catch {
            if (reserveOut * amountIn >= reserveIn + amountIn) {
                wronglyRefused = true;
            }
            return;
        }

        uint256 product = pool.reserve0() * pool.reserve1();
        if (product < lastProduct) productDecreased = true;
        lastProduct = product;
    }

    /// The two-sided check of testFuzz_OutputIsTheLargestThatKeepsTheProduct.
    /// The first test keeps the subtractions below from reverting.
    function checkOutput(
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 amountIn,
        uint256 amountOut
    ) internal {
        if (amountOut >= reserveOut) {
            wrongOutput = true;
            return;
        }
        uint256 product = reserveIn * reserveOut;
        uint256 grown = reserveIn + amountIn;
        if (
            grown * (reserveOut - amountOut) < product
                || grown * (reserveOut - amountOut - 1) >= product
        ) wrongOutput = true;
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

    function setUp() public {
        (uint256 goldAmount, uint256 silverAmount, uint256 maxTrade) =
            startingPool();

        pool = new ConstantProductPool(gold, silver);
        gold.mint(address(this), goldAmount);
        silver.mint(address(this), silverAmount);
        gold.approve(address(pool), goldAmount);
        silver.approve(address(pool), silverAmount);
        pool.initialize(goldAmount, silverAmount);

        trader = new Trader(pool, gold, silver, maxTrade);
        targetContract(address(trader));
    }

    function invariant_ReservesMatchBalances() public view {
        assertEq(pool.reserve0(), gold.balanceOf(address(pool)));
        assertEq(pool.reserve1(), silver.balanceOf(address(pool)));
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

    function invariant_OutputIsTheLargestThatKeepsTheProduct() public view {
        assertFalse(trader.wrongOutput());
    }

    function invariant_SwapsDoWhatTheyReturn() public view {
        assertFalse(trader.wrongBooks());
    }

    /// The checks above mean nothing unless some swaps went through.
    function afterInvariant() public view {
        assertGt(trader.swaps(), 0);
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
