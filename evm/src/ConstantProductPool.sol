// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.38;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Chapter 2: a constant-product pool.
/// @notice Implements the model in AMM.ConstantProduct. The pool holds two
/// tokens and pays out just enough that `reserve0 * reserve1` stays the same,
/// rounded down so it never falls.
///
/// The model's gold is `token0` and its silver is `token1`, so `GoldForSilver`
/// is `zeroForOne = true` and `SilverForGold` is `zeroForOne = false`.
contract ConstantProductPool {
    using SafeERC20 for IERC20;

    IERC20 public immutable token0;
    IERC20 public immutable token1;
    address public immutable owner;

    /// @notice How much of each token the pool has on its books.
    uint256 public reserve0;
    uint256 public reserve1;

    /// @notice A swap paid `amountIn` of one token for `amountOut` of the
    /// other.
    event Swap(
        address indexed trader,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @notice An amount is zero.
    error AmountNotPositive();
    /// @notice A reserve is empty, so there is no price.
    error EmptyPool();
    /// @notice The swap would pay out nothing, or less than `minAmountOut`.
    error OutputTooSmall();
    /// @notice Only the owner may provide the liquidity.
    error NotOwner();
    /// @notice The pool already holds its liquidity.
    error AlreadyInitialized();
    /// @notice A pool trades two different tokens.
    error IdenticalTokens();

    constructor(IERC20 token0_, IERC20 token1_) {
        if (address(token0_) == address(token1_)) revert IdenticalTokens();

        token0 = token0_;
        token1 = token1_;
        owner = msg.sender;
    }

    /// @notice Provide the pool's liquidity, once. The model's swap needs a
    /// pool that holds both tokens; this is how one comes to exist.
    function initialize(uint256 amount0, uint256 amount1) external {
        if (msg.sender != owner) revert NotOwner();
        // swaps keep both reserves positive, so a non-empty pool stays that way
        if (reserve0 != 0 || reserve1 != 0) revert AlreadyInitialized();
        if (amount0 == 0 || amount1 == 0) revert AmountNotPositive();

        reserve0 = amount0;
        reserve1 = amount1;

        token0.safeTransferFrom(msg.sender, address(this), amount0);
        token1.safeTransferFrom(msg.sender, address(this), amount1);
    }

    /// @notice Pay `amountIn` of one token and receive at least `minAmountOut`
    /// of the other. Refuses in the same order as the model.
    /// @return amountOut The amount paid out.
    function swap(bool zeroForOne, uint256 amountIn, uint256 minAmountOut)
        external
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert AmountNotPositive();
        if (reserve0 == 0 || reserve1 == 0) revert EmptyPool();

        (uint256 reserveIn, uint256 reserveOut) =
            zeroForOne ? (reserve0, reserve1) : (reserve1, reserve0);

        // keep reserveIn * reserveOut, rounding down in the pool's favour
        amountOut = reserveOut * amountIn / (reserveIn + amountIn);
        if (amountOut == 0 || amountOut < minAmountOut) {
            revert OutputTooSmall();
        }

        if (zeroForOne) {
            reserve0 = reserveIn + amountIn;
            reserve1 = reserveOut - amountOut;
        } else {
            reserve0 = reserveOut - amountOut;
            reserve1 = reserveIn + amountIn;
        }
        emit Swap(msg.sender, zeroForOne, amountIn, amountOut);

        // the books are settled before any other contract runs
        (IERC20 tokenIn, IERC20 tokenOut) =
            zeroForOne ? (token0, token1) : (token1, token0);
        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenOut.safeTransfer(msg.sender, amountOut);
    }
}
