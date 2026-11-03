// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.38;

import {
    IERC20Errors
} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Test, console} from "forge-std/Test.sol";
import {ConstantProductPool} from "../src/ConstantProductPool.sol";
import {TestToken} from "./TestToken.sol";

contract SixDecimals is TestToken {
    constructor() TestToken("Dollar", "USD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

/// The smallest test for each surviving mutant. All pass on the real contract.
contract DetectTest is Test {
    TestToken gold = new TestToken("Gold", "GLD");
    TestToken silver = new TestToken("Silver", "SLV");
    ConstantProductPool pool;
    address trader = makeAddr("trader");

    function setUp() public {
        pool = new ConstantProductPool(gold, silver);
    }

    function stock(uint256 g, uint256 s) internal {
        gold.mint(address(this), g);
        silver.mint(address(this), s);
        gold.approve(address(pool), g);
        silver.approve(address(pool), s);
        pool.initialize(g, s);
    }

    function pay(bool zeroForOne, uint256 amountIn, uint256 minimum)
        internal
        returns (uint256)
    {
        TestToken tokenIn = zeroForOne ? gold : silver;
        tokenIn.mint(trader, amountIn);
        vm.prank(trader);
        tokenIn.approve(address(pool), amountIn);
        vm.prank(trader);
        return pool.swap(zeroForOne, amountIn, minimum);
    }

    function test_D_UnlimitedApprovalAtInitialize() public {
        gold.mint(address(this), 5000);
        silver.mint(address(this), 5000);
        gold.approve(address(pool), type(uint256).max);
        silver.approve(address(pool), type(uint256).max);
        pool.initialize(1000, 4000);
        assertEq(gold.balanceOf(address(pool)), 1000);
        assertEq(silver.balanceOf(address(pool)), 4000);
        assertEq(gold.balanceOf(address(this)), 4000);
        assertEq(silver.balanceOf(address(this)), 1000);
    }

    function test_D_LaterBlockPaysTheSame() public {
        stock(1e6, 1e6);
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 12);
        assertEq(pay(true, 1e5, 0), 90909);
    }

    function test_D_InitializeInALaterBlock() public {
        vm.roll(block.number + 1);
        stock(1000, 1000);
        assertEq(pool.reserve0(), 1000);
    }

    function test_D_SixDecimalToken() public {
        gold = new SixDecimals();
        pool = new ConstantProductPool(gold, silver);
        stock(1000e6, 1000e18);
        // 1000e18 * 100e6 / 1100e6 is 90.9e18
        assertEq(pay(true, 100e6, 0), 90909090909090909090);
    }

    function test_D_HugeReservesThatSumPastUint256() public {
        stock(3 << 254, 1 << 254);
        // 3 * 2^254 / (2^254 + 1) is 2.99
        assertEq(pay(false, 1, 0), 2);
    }

    function test_D_ShortTraderWithUnlimitedApproval() public {
        stock(1000, 1000);
        gold.mint(trader, 50);
        vm.prank(trader);
        gold.approve(address(pool), type(uint256).max);
        vm.prank(trader);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, trader, 50, 100
            )
        );
        pool.swap(true, 100, 0);
    }

    function test_D_LargeDonationBeforeInitialize() public {
        gold.mint(address(pool), 2000);
        silver.mint(address(pool), 2000);
        stock(1000, 1000);
        assertEq(pool.reserve0(), 1000);
        assertEq(pool.reserve1(), 1000);
        assertEq(gold.balanceOf(address(pool)), 3000);
        assertEq(silver.balanceOf(address(pool)), 3000);
        assertEq(gold.balanceOf(address(this)), 0);
        assertEq(silver.balanceOf(address(this)), 0);
    }

    function test_D_TraderHoldingFarMoreThanTheTrade() public {
        stock(1e6, 1e6);
        gold.mint(trader, 1e6);
        assertEq(pay(true, 1e5, 0), 90909);
    }

    function test_D_ConstructorLeavesNoApproval() public {
        stock(1000, 1000);
        assertEq(gold.allowance(address(pool), address(this)), 0);
        assertEq(silver.allowance(address(pool), address(this)), 0);
        vm.expectRevert();
        gold.transferFrom(address(pool), address(this), 1000);
    }

    function test_D_ZeroAmountWithAHugeMinimum() public {
        stock(1000, 1000);
        vm.expectRevert(ConstantProductPool.AmountNotPositive.selector);
        vm.prank(trader);
        pool.swap(true, 0, 2000);
    }

    function test_D_PlainEtherRefused() public {
        vm.deal(address(this), 1);
        (bool taken,) = address(pool).call{value: 1}("");
        assertFalse(taken);
    }

    /// Not a mutant test: which token sits at the lower address here.
    function test_Z_AddressOrder() public view {
        console.log("gold  ", address(gold));
        console.log("silver", address(silver));
    }
}
