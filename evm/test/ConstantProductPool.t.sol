// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.38;

import {stdError} from "forge-std/StdError.sol";
import {Test} from "forge-std/Test.sol";
import {ConstantProductPool} from "../src/ConstantProductPool.sol";
import {SixDecimalToken, TestToken} from "./TestToken.sol";

contract ConstantProductPoolTest is Test {
    // Keeps every product the fuzz tests compute inside uint256: none is more
    // than twice this squared, which is below 2^255. The model's Integer has
    // no such limit, and the examples at the end of this file go past it.
    uint256 constant MAX_AMOUNT = type(uint128).max >> 1;

    // A copy of the pool's event, so that changing the pool's fails the tests.
    event Swap(
        address indexed trader,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut
    );

    TestToken gold = new TestToken("Gold", "GLD");
    TestToken silver = new TestToken("Silver", "SLV");
    ConstantProductPool pool;
    address trader = makeAddr("trader");

    /// How much more than a call costs is held and approved for it, so that a
    /// pool that takes too much shows.
    uint256 spare = 1;

    function setUp() public {
        pool = new ConstantProductPool(gold, silver);
    }

    /// Give the owner what the liquidity costs and let the pool take it.
    function supply(uint256 goldAmount, uint256 silverAmount) internal {
        gold.mint(address(this), goldAmount + spare);
        silver.mint(address(this), silverAmount + spare);
        gold.approve(address(pool), goldAmount + spare);
        silver.approve(address(pool), silverAmount + spare);
    }

    /// Provide liquidity as the owner.
    function stock(uint256 goldAmount, uint256 silverAmount) internal {
        supply(goldAmount, silverAmount);
        pool.initialize(goldAmount, silverAmount);
    }

    /// Give the trader what the swap costs and let the pool take it.
    function fund(bool zeroForOne, uint256 amountIn) internal {
        TestToken tokenIn = zeroForOne ? gold : silver;
        tokenIn.mint(trader, amountIn + spare);
        vm.prank(trader);
        tokenIn.approve(address(pool), amountIn + spare);
    }

    /// What a swap can change, from the side of the token paid in and the
    /// token paid out.
    struct Books {
        uint256 reserveIn;
        uint256 reserveOut;
        uint256 poolIn;
        uint256 poolOut;
        uint256 traderIn;
        uint256 traderOut;
    }

    function books(bool zeroForOne) internal view returns (Books memory) {
        (TestToken tokenIn, TestToken tokenOut) =
            zeroForOne ? (gold, silver) : (silver, gold);
        return Books({
            reserveIn: reserveIn(zeroForOne),
            reserveOut: reserveOut(zeroForOne),
            poolIn: tokenIn.balanceOf(address(pool)),
            poolOut: tokenOut.balanceOf(address(pool)),
            traderIn: tokenIn.balanceOf(trader),
            traderOut: tokenOut.balanceOf(trader)
        });
    }

    /// Run a swap that has to succeed, and check that what it returned is
    /// what happened to the reserves and to both sides' tokens.
    function trade(bool zeroForOne, uint256 amountIn, uint256 minAmountOut)
        internal
        returns (uint256 amountOut)
    {
        fund(zeroForOne, amountIn);
        Books memory before = books(zeroForOne);

        vm.prank(trader);
        amountOut = pool.swap(zeroForOne, amountIn, minAmountOut);

        Books memory afterwards = books(zeroForOne);
        assertEq(afterwards.reserveIn, before.reserveIn + amountIn);
        assertEq(afterwards.reserveOut, before.reserveOut - amountOut);
        assertEq(afterwards.poolIn, before.poolIn + amountIn);
        assertEq(afterwards.poolOut, before.poolOut - amountOut);
        assertEq(afterwards.traderIn, before.traderIn - amountIn);
        assertEq(afterwards.traderOut, before.traderOut + amountOut);
        // the pool pays out, and lets nobody take more later
        TestToken tokenOut = zeroForOne ? silver : gold;
        assertEq(tokenOut.allowance(address(pool), trader), 0);
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

    /// Run a swap the model accepts, which has to succeed. One that pays
    /// nothing has to be refused, and the fuzzer then drops the case, as the
    /// model's properties only check the swaps that succeed.
    function tradeOrDiscard(bool zeroForOne, uint256 amountIn)
        internal
        returns (uint256)
    {
        if (
            reserveOut(zeroForOne) * amountIn < reserveIn(zeroForOne) + amountIn
        ) {
            assertRefused(
                zeroForOne,
                amountIn,
                0,
                ConstantProductPool.OutputTooSmall.selector
            );
            vm.assume(false);
        }
        return trade(zeroForOne, amountIn, 0);
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

    function reserveIn(bool zeroForOne) internal view returns (uint256) {
        return zeroForOne ? pool.reserve0() : pool.reserve1();
    }

    function reserveOut(bool zeroForOne) internal view returns (uint256) {
        return zeroForOne ? pool.reserve1() : pool.reserve0();
    }

    // Worked examples: each result is what AMM.ConstantProduct.swap gives.

    function test_SwapGoldForSilver() public {
        stock(1000, 4000);
        assertEq(trade(true, 100, 0), 363);
        assertReserves(1100, 3637);
    }

    function test_SwapSilverForGold() public {
        stock(1000, 4000);
        assertEq(trade(false, 400, 0), 90);
        assertReserves(910, 4400);
    }

    function test_SwapAtAnExactQuotient() public {
        stock(100, 100);
        // 100 * 100 / 200 is exactly 50, so nothing rounding could hide
        assertEq(trade(true, 100, 0), 50);
        assertReserves(200, 50);
    }

    function test_SwapRoundsDown() public {
        stock(10, 10);
        // 10 * 3 / 13 is 2.3
        assertEq(trade(true, 3, 0), 2);
        assertReserves(13, 8);
    }

    /// The second swap is priced from the reserves the first one left, for
    /// the same trader or another.
    function test_SecondSwapIsPricedAfterTheFirst() public {
        stock(1000, 1000);
        assertEq(trade(true, 100, 0), 90);
        // 910 * 100 / 1200 is 75.8
        assertRefused(
            true, 100, 76, ConstantProductPool.OutputTooSmall.selector
        );
        trader = makeAddr("second trader");
        assertEq(trade(true, 100, 0), 75);
    }

    function test_SwapRefusesToPayNothing() public {
        stock(1000, 1);
        assertRefused(true, 1, 0, ConstantProductPool.OutputTooSmall.selector);
    }

    /// A zero amount is refused first, so on an empty pool as well.
    function testFuzz_SwapRefusesZeroAmount(bool zeroForOne, bool open) public {
        if (open) stock(1000, 1000);
        assertRefused(
            zeroForOne, 0, 1, ConstantProductPool.AmountNotPositive.selector
        );
    }

    /// Holding tokens does not open a pool, whatever the minimum.
    function testFuzz_SwapRefusesEmptyPool(
        bool zeroForOne,
        uint256 amountIn,
        uint256 minimum
    ) public {
        gold.mint(address(pool), 1);
        silver.mint(address(pool), 1);
        vm.prank(trader);
        vm.expectRevert(ConstantProductPool.EmptyPool.selector);
        pool.swap(zeroForOne, bound(amountIn, 1, MAX_AMOUNT), minimum);
    }

    // The model's properties, under their names in
    // AMM.ConstantProductProperties, and one it does not state.

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

    /// A swap pays the same for any minimum up to its output, and is refused
    /// for any minimum above it, starting one above.
    function testFuzz_OutputAtLeastMinimum(
        uint256 goldAmount,
        uint256 silverAmount,
        bool zeroForOne,
        uint256 amountIn,
        uint256 minimum,
        uint256 highMinimum
    ) public {
        stockFuzzed(goldAmount, silverAmount);
        amountIn = bound(amountIn, 1, MAX_AMOUNT);

        uint256 start = vm.snapshotState();
        uint256 amountOut = tradeOrDiscard(zeroForOne, amountIn);

        vm.revertToState(start);
        minimum = bound(minimum, 0, amountOut);
        assertEq(trade(zeroForOne, amountIn, minimum), amountOut);

        vm.revertToState(start);
        assertRefused(
            zeroForOne,
            amountIn,
            amountOut + 1,
            ConstantProductPool.OutputTooSmall.selector
        );

        vm.revertToState(start);
        assertRefused(
            zeroForOne,
            amountIn,
            bound(highMinimum, amountOut + 1, type(uint256).max),
            ConstantProductPool.OutputTooSmall.selector
        );
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
        // the way back may pay nothing and be refused, which is no profit
        // either: the model passes that case, and the fuzzer draws another
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

    /// What the model's formula means, which none of its properties pin down:
    /// the output is the largest that keeps the product. One unit more would
    /// lower it, so this catches a pool that underpays as well as one that
    /// overpays, without repeating the formula.
    function testFuzz_OutputIsTheLargestThatKeepsTheProduct(
        uint256 goldAmount,
        uint256 silverAmount,
        bool zeroForOne,
        uint256 amountIn
    ) public {
        stockFuzzed(goldAmount, silverAmount);
        amountIn = bound(amountIn, 1, MAX_AMOUNT);
        uint256 reserveA = reserveIn(zeroForOne);
        uint256 reserveB = reserveOut(zeroForOne);
        uint256 product = reserveA * reserveB;

        uint256 amountOut = tradeOrDiscard(zeroForOne, amountIn);

        assertGe((reserveA + amountIn) * (reserveB - amountOut), product);
        assertLt((reserveA + amountIn) * (reserveB - amountOut - 1), product);
    }

    // What the model does not describe: owners, tokens, events and uint256.

    function test_ConstructorKeepsTheTokensInTheOrderGiven() public {
        assertEq(address(pool.token0()), address(gold));
        assertEq(address(pool.token1()), address(silver));
        assertEq(pool.owner(), address(this));

        vm.expectRevert(ConstantProductPool.IdenticalTokens.selector);
        new ConstantProductPool(gold, gold);
    }

    /// Either token may have the lower address, and an unlimited approval
    /// still takes only the amounts given.
    function testFuzz_InitializeTakesTheTokens(bool reversed, bool unlimited)
        public
    {
        if (reversed) (gold, silver) = (silver, gold);
        pool = new ConstantProductPool(gold, silver);
        supply(1000, 4000);
        if (unlimited) {
            gold.approve(address(pool), type(uint256).max);
            silver.approve(address(pool), type(uint256).max);
        }
        vm.recordLogs();
        pool.initialize(1000, 4000);
        // the two transfers
        assertEq(vm.getRecordedLogs().length, 2);

        assertReserves(1000, 4000);
        assertEq(gold.balanceOf(address(pool)), 1000);
        assertEq(silver.balanceOf(address(pool)), 4000);
        assertEq(gold.balanceOf(address(this)), 1);
        assertEq(silver.balanceOf(address(this)), 1);
    }

    function testFuzz_InitializeNeedsBothTokens(bool hasGold) public {
        TestToken held = hasGold ? gold : silver;
        held.mint(address(this), 1000);
        held.approve(address(pool), 1000);
        vm.expectRevert();
        pool.initialize(1000, 1000);
    }

    function test_InitializeIsOnlyForTheOwner() public {
        vm.prank(trader);
        vm.expectRevert(ConstantProductPool.NotOwner.selector);
        pool.initialize(1000, 1000);

        // being called from the owner's transaction does not make one the owner
        vm.prank(trader, address(this));
        vm.expectRevert(ConstantProductPool.NotOwner.selector);
        pool.initialize(1000, 1000);

        // nor does being a contract, or an address above the owner's
        vm.prank(address(gold));
        vm.expectRevert(ConstantProductPool.NotOwner.selector);
        pool.initialize(1000, 1000);
        vm.prank(address(type(uint160).max));
        vm.expectRevert(ConstantProductPool.NotOwner.selector);
        pool.initialize(1000, 1000);

        stock(1000, 1000);
        vm.prank(trader);
        vm.expectRevert(ConstantProductPool.NotOwner.selector);
        pool.initialize(1000, 1000);
    }

    function test_InitializeHappensOnce() public {
        stock(1000, 1000);
        vm.expectRevert(ConstantProductPool.AlreadyInitialized.selector);
        pool.initialize(1000, 1000);
        vm.expectRevert(ConstantProductPool.AlreadyInitialized.selector);
        pool.initialize(2000, 3000);

        trade(true, 100, 0);
        vm.expectRevert(ConstantProductPool.AlreadyInitialized.selector);
        pool.initialize(1100, 910);
    }

    function test_InitializeRefusesAnEmptyReserve() public {
        vm.expectRevert(ConstantProductPool.AmountNotPositive.selector);
        pool.initialize(1000, 0);
        vm.expectRevert(ConstantProductPool.AmountNotPositive.selector);
        pool.initialize(0, 1000);
        vm.expectRevert(ConstantProductPool.AmountNotPositive.selector);
        pool.initialize(0, 0);
    }

    /// The pool prices raw amounts, so a token with 6 decimals, as USDC has,
    /// trades as one with 18 does.
    function testFuzz_TokenWithOtherDecimals(bool zeroForOne) public {
        silver = new SixDecimalToken("Silver", "SLV");
        pool = new ConstantProductPool(gold, silver);
        stock(1000, 1000);
        assertEq(trade(zeroForOne, 100, 0), 90);
    }

    /// The model knows no owner, so the owner pays the same as anyone else.
    function test_OwnerTradesLikeAnyoneElse() public {
        stock(1000, 1000);
        trader = address(this);
        assertRefused(
            true, 100, 91, ConstantProductPool.OutputTooSmall.selector
        );
        assertEq(trade(true, 100, 0), 90);
        // 1100 * 100 / 1010 is 108.9
        assertEq(trade(false, 100, 0), 108);
        assertReserves(992, 1010);
    }

    /// Tokens sent to the pool stay off its books, before or after it opens.
    /// The two donations differ, so that one cannot cancel the other.
    function testFuzz_DonationChangesNothing(bool zeroForOne) public {
        gold.mint(address(pool), 1);
        silver.mint(address(pool), 2);
        stock(1000, 1000);
        assertReserves(1000, 1000);
        assertEq(gold.balanceOf(address(pool)), 1001);
        assertEq(silver.balanceOf(address(pool)), 1002);

        gold.mint(address(pool), 500);
        silver.mint(address(pool), 500);
        assertEq(trade(zeroForOne, 100, 0), 90);
        assertEq(reserveIn(zeroForOne), 1100);
        assertEq(reserveOut(zeroForOne), 910);
    }

    function testFuzz_SwapEmitsAnEvent(bool zeroForOne) public {
        stock(1000, 1000);
        fund(zeroForOne, 100);
        vm.expectEmit(address(pool));
        emit Swap(trader, zeroForOne, 100, 90);
        vm.prank(trader);
        pool.swap(zeroForOne, 100, 0);
    }

    /// A trader who has not approved enough, or does not hold enough, gets
    /// nothing.
    function testFuzz_SwapNeedsTheTradersTokens(bool zeroForOne, bool approved)
        public
    {
        stock(1000, 1000);
        TestToken tokenIn = zeroForOne ? gold : silver;
        tokenIn.mint(trader, approved ? 99 : 100);
        vm.prank(trader);
        tokenIn.approve(address(pool), approved ? 100 : 99);
        vm.prank(trader);
        vm.expectRevert();
        pool.swap(zeroForOne, 100, 0);
    }

    // Past the range of the fuzz tests. A swap stops only where a product or
    // a sum does not fit in uint256, so the next two answer as the model does.

    function testFuzz_SmallTradeOnAHugePool(bool zeroForOne) public {
        // the reserves' own product does not fit, and the swap never needs it
        stock(1 << 128, 1 << 128);
        assertEq(trade(zeroForOne, 1000, 0), 999);
    }

    function test_HugeTradeOnASmallPool() public {
        stock(1000, 1000);
        assertEq(trade(true, 1 << 128, 0), 999);
        assertReserves(1000 + (1 << 128), 1);
    }

    /// The model's Integer has no limit, so it prices this trade. Here
    /// reserveOut * amountIn does not fit in uint256 and the swap reverts.
    function testFuzz_LargeTradeOverflows(bool zeroForOne) public {
        stock(1 << 200, 1 << 200);
        fund(zeroForOne, 1 << 100);
        vm.prank(trader);
        vm.expectRevert(stdError.arithmeticError);
        pool.swap(zeroForOne, 1 << 100, 0);
    }

    /// Here it is reserveIn + amountIn that does not fit. No token could fund
    /// this trade, and the swap reverts before it asks for the tokens.
    function test_LargeSumOverflows() public {
        spare = 0;
        stock(1 << 255, 1);
        vm.prank(trader);
        vm.expectRevert(stdError.arithmeticError);
        pool.swap(true, 1 << 255, 0);
    }
}
