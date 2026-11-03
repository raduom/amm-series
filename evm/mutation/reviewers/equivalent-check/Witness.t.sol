// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test, console} from "forge-std/Test.sol";
import {ConstantProductPool} from "../src/ConstantProductPool.sol";
import {TestToken} from "./TestToken.sol";

contract WitnessTest is Test {
    function test_StaticInitializeWithZero() public {
        TestToken gold = new TestToken("Gold", "GLD");
        TestToken silver = new TestToken("Silver", "SLV");
        ConstantProductPool pool = new ConstantProductPool(gold, silver);
        (bool ok, bytes memory data) = address(pool).staticcall(
            abi.encodeCall(ConstantProductPool.initialize, (0, 1))
        );
        console.log("ok", ok);
        console.logBytes(data);
        assertFalse(ok);
        assertEq(data, abi.encodeWithSelector(ConstantProductPool.AmountNotPositive.selector));
    }
}
