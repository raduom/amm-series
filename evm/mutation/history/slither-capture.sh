#!/bin/bash
# Stand-in test command: passes on the unchanged contract, saves every changed copy.
W=/tmp/amm-slither; F=src/ConstantProductPool.sol
n=$(sha256sum $F | cut -d' ' -f1)
[ "$n" = "$(cat $W/orig.sha)" ] && exit 0
mkdir -p $W/saved/$n && cp $F $W/saved/$n/ConstantProductPool.sol
exit 1
