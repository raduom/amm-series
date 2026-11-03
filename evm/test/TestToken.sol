// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.38;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice An ERC-20 that anyone can mint, for tests only.
contract TestToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice A TestToken with 6 decimals, as USDC has.
contract SixDecimalToken is TestToken {
    constructor(string memory name, string memory symbol)
        TestToken(name, symbol)
    {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
