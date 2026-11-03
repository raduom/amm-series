#!/bin/bash
# Prints the contract every diff in bugs/ is made against: the pool as of commit b2b1365,
# the last commit to change it.
git -C "$(dirname "$0")" show b2b1365:evm/src/ConstantProductPool.sol
