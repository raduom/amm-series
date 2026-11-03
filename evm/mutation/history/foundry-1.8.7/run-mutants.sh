#!/bin/bash
# usage: run-mutants.sh <list file of "name srcdir">
# Same method as score-corpus.sh, with v1.8.7 by path, every seed always run,
# results kept outside /tmp, and a stop if the battery falls.
L=$HOME/.local/share/amm-series/foundry-upgrade
export W=/tmp/amm-fw/mutants R=$L/mutants-187.txt LOGS=$L/mutant-logs
export S=/home/raduom/Spaces/amm-series/evm
export F=$HOME/.config/.foundry/versions/foundry-rs/foundry/v1.8.7/forge
export BAT=/sys/class/power_supply/BAT0
export FLOOR=$(( $(cat $BAT/energy_now) - 300000 ))   # 0.3 Wh below the start
mkdir -p $W $LOGS; touch $R
one() {
  n=$1; src=$2
  grep -q "^$n " $R && exit 0
  e=$(cat $BAT/energy_now)
  [ "$e" -lt "$FLOOR" ] && { echo "$(date +%T) $e below $FLOOR" >> $W/PAUSED; }
  [ -e $W/PAUSED ] && exit 0
  d=$W/$n; mkdir -p $d/src
  cp $src/src/ConstantProductPool.sol $d/src/
  cp -r $S/test $S/foundry.toml $d/
  ln -sfn $S/lib $d/lib
  cd $d || exit 1
  export FOUNDRY_INVARIANT_RUNS=25 FOUNDRY_INVARIANT_DEPTH=100 FOUNDRY_INVARIANT_SHRINK_RUN_LIMIT=0
  res=caught
  for s in 1 7; do
    mv cache/invariant cache/invariant.$s 2>/dev/null; mv cache/fuzz cache/fuzz.$s 2>/dev/null
    o=$($F test --threads 4 --fuzz-seed $s 2>&1 | sed 's/\x1b\[[0-9;]*m//g')
    { echo "$o" | grep -E '^\[FAIL|^\[PASS\] invariant|invariants \(runs|^Ran [0-9]+ test suites|^Error|^error|Compiler run failed'; } > $LOGS/$n.s$s.txt
    r=$(echo "$o" | grep -E 'tests? passed' | tail -1 | grep -oE '[0-9]+ failed')
    if [ -z "$r" ]; then res=compile-error; break; fi
    [ "$r" = "0 failed" ] && res=survived
    fails="$fails s$s:${r% failed}"
  done
  echo "$n $res$fails" >> $R
}
export -f one
( while :; do echo "$(date +%T) $(cat $BAT/capacity) $(cat $BAT/energy_now)" >> $L/power.log; sleep 60; done ) &
SAMPLER=$!
xargs -P 2 -L 1 bash -c 'one $0 $1' < "$1"
kill $SAMPLER
awk '{print $2}' $R | sort | uniq -c
[ -e $W/PAUSED ] && { echo PAUSED; cat $W/PAUSED; }
