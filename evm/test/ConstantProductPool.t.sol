// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.38;

import {
    IERC20Errors
} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {stdError} from "forge-std/StdError.sol";
import {Test} from "forge-std/Test.sol";
import {ConstantProductPool} from "../src/ConstantProductPool.sol";
import {TestToken} from "./TestToken.sol";

contract ConstantProductPoolTest is Test {
    // Keeps reserve * amount inside uint256. The model's Integer has no such
    // limit; test_LargeTradeOverflows shows what lies beyond it.
    uint256 constant MAX_AMOUNT = type(uint112).max;

    TestToken gold = new TestToken("Gold", "GLD");
    TestToken silver = new TestToken("Silver", "SLV");
    ConstantProductPool pool;
    address trader = makeAddr("trader");

    function setUp() public {
        pool = new ConstantProductPool(gold, silver);
    }

    /// Provide liquidity as the owner.
    function stock(uint256 goldAmount, uint256 silverAmount) internal {
        gold.mint(address(this), goldAmount);
        silver.mint(address(this), silverAmount);
        gold.approve(address(pool), goldAmount);
        silver.approve(address(pool), silverAmount);
        pool.initialize(goldAmount, silverAmount);
    }

    /// Give the trader what the swap costs and let the pool take it.
    function fund(bool zeroForOne, uint256 amountIn) internal {
        TestToken tokenIn = zeroForOne ? gold : silver;
        tokenIn.mint(trader, amountIn);
        vm.prank(trader);
        tokenIn.approve(address(pool), amountIn);
    }

    /// Run a swap that has to succeed.
    function trade(bool zeroForOne, uint256 amountIn, uint256 minAmountOut)
        internal
        returns (uint256)
    {
        fund(zeroForOne, amountIn);
        vm.prank(trader);
        return pool.swap(zeroForOne, amountIn, minAmountOut);
    }

    /// Expect the next swap to be refused with `reason`.
    function assertRefused(
        bool zeroForOne,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes4 reason
    ) internal {
        fund(zeroForOne, amountIn);
        vm.prank(trader);
        vm.expectRevert(reason);
        pool.swap(zeroForOne, amountIn, minAmountOut);
    }

    /// Run a swap; the fuzzer drops the case if it is refused, as the model's
    /// properties only check the swaps that succeed.
    function tradeOrDiscard(bool zeroForOne, uint256 amountIn)
        internal
        returns (uint256 amountOut)
    {
        fund(zeroForOne, amountIn);
        vm.prank(trader);
        try pool.swap(zeroForOne, amountIn, 0) returns (uint256 out) {
            amountOut = out;
        } catch {
            vm.assume(false);
        }
    }

    function stockFuzzed(uint256 goldAmount, uint256 silverAmount) internal {
        stock(
            bound(goldAmount, 1, MAX_AMOUNT), bound(silverAmount, 1, MAX_AMOUNT)
        );
    }

    function assertReserves(uint256 expected0, uint256 expected1)
        internal
        view
    {
        assertEq(pool.reserve0(), expected0);
        assertEq(pool.reserve1(), expected1);
    }

    function reserveOut(bool zeroForOne) internal view returns (uint256) {
        return zeroForOne ? pool.reserve1() : pool.reserve0();
    }

    // Worked examples: each result is what AMM.ConstantProduct.swap gives.

    function test_SwapGoldForSilver() public {
        stock(1000, 1000);
        assertEq(trade(true, 100, 0), 90);
        assertReserves(1100, 910);
    }

    function test_SwapSilverForGold() public {
        stock(1000, 1000);
        assertEq(trade(false, 100, 0), 90);
        assertReserves(910, 1100);
    }

    function test_SwapAtAnUnevenPool() public {
        stock(1000, 4000);
        assertEq(trade(true, 100, 0), 363);
        assertReserves(1100, 3637);
    }

    function test_SwapBackAtAnUnevenPool() public {
        stock(1000, 4000);
        assertEq(trade(false, 400, 0), 90);
        assertReserves(910, 4400);
    }

    function test_SwapRoundsDown() public {
        stock(10, 10);
        // 10 * 3 / 13 is 2.3
        assertEq(trade(true, 3, 0), 2);
        assertReserves(13, 8);
    }

    function test_SwapPaysExactlyMinAmountOut() public {
        stock(1000, 1000);
        assertEq(trade(true, 100, 90), 90);
        assertReserves(1100, 910);
    }

    function test_SwapRefusesLessThanMinAmountOut() public {
        stock(1000, 1000);
        assertRefused(
            true, 100, 91, ConstantProductPool.OutputTooSmall.selector
        );
    }

    function test_SwapRefusesToPayNothing() public {
        stock(1000, 1);
        assertRefused(true, 1, 0, ConstantProductPool.OutputTooSmall.selector);
    }

    function test_SwapRefusesZeroAmount() public {
        stock(1000, 1000);
        assertRefused(
            true, 0, 0, ConstantProductPool.AmountNotPositive.selector
        );
    }

    function test_SwapRefusesEmptyPool() public {
        assertRefused(true, 1, 0, ConstantProductPool.EmptyPool.selector);
    }

    function test_SwapChecksAmountBeforeEmptyPool() public {
        assertRefused(
            true, 0, 0, ConstantProductPool.AmountNotPositive.selector
        );
    }

    // The model's properties. Their names match AMM.ConstantProductProperties.

    function testFuzz_ProductNeverDecreases(
        uint256 goldAmount,
        uint256 silverAmount,
        bool zeroForOne,
        uint256 amountIn
    ) public {
        stockFuzzed(goldAmount, silverAmount);
        uint256 product = pool.reserve0() * pool.reserve1();
        tradeOrDiscard(zeroForOne, bound(amountIn, 1, MAX_AMOUNT));
        assertGe(pool.reserve0() * pool.reserve1(), product);
    }

    function testFuzz_OutputBelowReserve(
        uint256 goldAmount,
        uint256 silverAmount,
        bool zeroForOne,
        uint256 amountIn
    ) public {
        stockFuzzed(goldAmount, silverAmount);
        uint256 reserve = reserveOut(zeroForOne);
        uint256 amountOut =
            tradeOrDiscard(zeroForOne, bound(amountIn, 1, MAX_AMOUNT));
        assertLt(amountOut, reserve);
    }

    /// Stronger than the model's property: a swap succeeds at exactly its
    /// output as the minimum, and is refused one above it.
    function testFuzz_OutputAtLeastMinimum(
        uint256 goldAmount,
        uint256 silverAmount,
        bool zeroForOne,
        uint256 amountIn
    ) public {
        stockFuzzed(goldAmount, silverAmount);
        amountIn = bound(amountIn, 1, MAX_AMOUNT);

        uint256 start = vm.snapshotState();
        uint256 amountOut = tradeOrDiscard(zeroForOne, amountIn);

        vm.revertToState(start);
        assertRefused(
            zeroForOne,
            amountIn,
            amountOut + 1,
            ConstantProductPool.OutputTooSmall.selector
        );

        vm.revertToState(start);
        assertEq(trade(zeroForOne, amountIn, amountOut), amountOut);
    }

    /// Paying more never gets a better price, except by what rounding took
    /// from the smaller trade: less than one unit of its output. Compared
    /// without dividing: out' / in' < (out + 1) / in.
    function testFuzz_LargerTradesWorsePrices(
        uint256 goldAmount,
        uint256 silverAmount,
        bool zeroForOne,
        uint256 amountIn,
        uint256 extra
    ) public {
        stockFuzzed(goldAmount, silverAmount);
        amountIn = bound(amountIn, 1, MAX_AMOUNT);
        uint256 largerIn = amountIn + bound(extra, 1, MAX_AMOUNT);

        uint256 start = vm.snapshotState();
        uint256 amountOut = tradeOrDiscard(zeroForOne, amountIn);

        vm.revertToState(start);
        uint256 largerOut = trade(zeroForOne, largerIn, 0);

        assertGe(largerOut, amountOut);
        assertLt(largerOut * amountIn, (amountOut + 1) * largerIn);
    }

    function testFuzz_RoundTripNeverProfits(
        uint256 goldAmount,
        uint256 silverAmount,
        bool zeroForOne,
        uint256 amountIn
    ) public {
        stockFuzzed(goldAmount, silverAmount);
        amountIn = bound(amountIn, 1, MAX_AMOUNT);
        uint256 amountOut = tradeOrDiscard(zeroForOne, amountIn);
        // the way back may be refused, which is no profit either
        uint256 back = tradeOrDiscard(!zeroForOne, amountOut);
        assertLe(back, amountIn);
    }

    function testFuzz_ReservesStayPositive(
        uint256 goldAmount,
        uint256 silverAmount,
        bool zeroForOne,
        uint256 amountIn
    ) public {
        stockFuzzed(goldAmount, silverAmount);
        tradeOrDiscard(zeroForOne, bound(amountIn, 1, MAX_AMOUNT));
        assertGt(pool.reserve0(), 0);
        assertGt(pool.reserve1(), 0);
    }

    // What the model does not describe: owners, tokens, events and uint256.

    function test_InitializeTakesTheTokens() public {
        stock(1000, 4000);
        assertReserves(1000, 4000);
        assertEq(gold.balanceOf(address(pool)), 1000);
        assertEq(silver.balanceOf(address(pool)), 4000);
        assertEq(gold.balanceOf(address(this)), 0);
        assertEq(silver.balanceOf(address(this)), 0);
    }

    function test_InitializeIsOnlyForTheOwner() public {
        vm.prank(trader);
        vm.expectRevert(ConstantProductPool.NotOwner.selector);
        pool.initialize(1000, 1000);
    }

    function test_InitializeHappensOnce() public {
        stock(1000, 1000);
        vm.expectRevert(ConstantProductPool.AlreadyInitialized.selector);
        pool.initialize(1000, 1000);
    }

    function test_InitializeRefusesAnEmptyReserve() public {
        vm.expectRevert(ConstantProductPool.AmountNotPositive.selector);
        pool.initialize(1000, 0);
        vm.expectRevert(ConstantProductPool.AmountNotPositive.selector);
        pool.initialize(0, 1000);
    }

    function test_SwapMovesTheTokens() public {
        stock(1000, 1000);
        trade(true, 100, 0);
        assertEq(gold.balanceOf(trader), 0);
        assertEq(silver.balanceOf(trader), 90);
        assertEq(gold.balanceOf(address(pool)), 1100);
        assertEq(silver.balanceOf(address(pool)), 910);
    }

    function test_SwapMovesTheTokensTheOtherWay() public {
        stock(1000, 1000);
        trade(false, 100, 0);
        assertEq(gold.balanceOf(trader), 90);
        assertEq(silver.balanceOf(trader), 0);
        assertEq(gold.balanceOf(address(pool)), 910);
        assertEq(silver.balanceOf(address(pool)), 1100);
    }

    function test_SwapEmitsAnEvent() public {
        stock(1000, 1000);
        fund(true, 100);
        vm.expectEmit(address(pool));
        emit ConstantProductPool.Swap(trader, true, 100, 90);
        vm.prank(trader);
        pool.swap(true, 100, 0);
    }

    function test_SwapWithoutApprovalChangesNothing() public {
        stock(1000, 1000);
        gold.mint(trader, 100);
        vm.prank(trader);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(pool),
                0,
                100
            )
        );
        pool.swap(true, 100, 0);
        assertReserves(1000, 1000);
        assertEq(gold.balanceOf(trader), 100);
    }

    function test_RefusedSwapChangesNothing() public {
        stock(1000, 1000);
        assertRefused(
            true, 100, 91, ConstantProductPool.OutputTooSmall.selector
        );
        assertReserves(1000, 1000);
        assertEq(gold.balanceOf(trader), 100);
        assertEq(silver.balanceOf(trader), 0);
    }

    /// The model's Integer has no limit, so it prices this trade. Here
    /// reserveOut * amountIn does not fit in uint256 and the swap reverts.
    function test_LargeTradeOverflows() public {
        stock(1 << 200, 1 << 200);
        fund(true, 1 << 100);
        vm.prank(trader);
        vm.expectRevert(stdError.arithmeticError);
        pool.swap(true, 1 << 100, 0);
    }
}
