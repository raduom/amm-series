// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.38;

import {StdUtils} from "forge-std/StdUtils.sol";
import {Test} from "forge-std/Test.sol";
import {ConstantProductPool} from "../src/ConstantProductPool.sol";
import {TestToken} from "./TestToken.sol";

/// Trades with the pool in whatever order the fuzzer picks.
contract Trader is StdUtils {
    uint256 constant MAX_AMOUNT = 1e24;

    ConstantProductPool pool;
    TestToken gold;
    TestToken silver;

    /// The pool's product after the latest swap, and whether one lowered it.
    uint256 public lastProduct;
    bool public productDecreased;
    uint256 public swaps;

    constructor(ConstantProductPool pool_, TestToken gold_, TestToken silver_) {
        pool = pool_;
        gold = gold_;
        silver = silver_;
        lastProduct = pool.reserve0() * pool.reserve1();
    }

    function swap(bool zeroForOne, uint256 amountIn) external {
        amountIn = bound(amountIn, 1, MAX_AMOUNT);
        TestToken tokenIn = zeroForOne ? gold : silver;
        tokenIn.mint(address(this), amountIn);
        tokenIn.approve(address(pool), amountIn);

        try pool.swap(zeroForOne, amountIn, 0) {
            swaps++;
        } catch {
            return;
        }

        uint256 product = pool.reserve0() * pool.reserve1();
        if (product < lastProduct) productDecreased = true;
        lastProduct = product;
    }
}

contract ConstantProductPoolInvariantTest is Test {
    TestToken gold = new TestToken("Gold", "GLD");
    TestToken silver = new TestToken("Silver", "SLV");
    ConstantProductPool pool;
    Trader trader;

    function setUp() public {
        pool = new ConstantProductPool(gold, silver);
        gold.mint(address(this), 1e24);
        silver.mint(address(this), 4e24);
        gold.approve(address(pool), 1e24);
        silver.approve(address(pool), 4e24);
        pool.initialize(1e24, 4e24);

        trader = new Trader(pool, gold, silver);
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

    /// The checks above mean nothing unless some swaps went through.
    function afterInvariant() public view {
        assertGt(trader.swaps(), 0);
    }
}
