// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ConstantProductPool} from "../src/ConstantProductPool.sol";
contract NothingTest { function test_Same() public pure {
  require(keccak256(type(ConstantProductPool).creationCode) == 0xf42a67dc34320739466e2ba5942a2a6a4c3a8e9e5de9f6ae6654f422773ff69c);
} }
