#!/bin/bash
# usage: score.sh <label> <suite dir> <list of "name diff">
# Every bug gets its own copy of the contract with its diff applied, the suite's tests,
# a clean cache, seeds 1 and 7 and two jobs at once. Writes "<name> caught|survived
# s1:<failed> s7:<failed>", or "<name> compile-error", to $WORK/results/<label>.txt.
# Stops starting new bugs if the battery falls 3 Wh below where it began, and resumes
# from the results file when run again.
M=$(cd "$(dirname "$0")/.." && pwd)
export M L=$1 S=$(realpath "$2") WORK=${WORK:-/tmp/amm-mutation}
export W=$WORK/score/$1 R=$WORK/results/$1.txt F=${FORGE:-forge}
export BAT=/sys/class/power_supply/BAT0
[ -e $BAT/energy_now ] && export FLOOR=$(( $(cat $BAT/energy_now) - 3000000 ))
mkdir -p $W $WORK/results; touch $R
"$M/scripts/contract.sh" > $WORK/contract.sol || exit 1
one() {
  n=$1; diff=$2
  grep -q "^$n " $R && exit 0
  [ -n "$FLOOR" ] && [ "$(cat $BAT/energy_now)" -lt "$FLOOR" ] && date +%T >> $W/PAUSED
  [ -e $W/PAUSED ] && exit 0
  d=$W/$n; mkdir -p $d/src
  patch -s -o $d/src/ConstantProductPool.sol $WORK/contract.sol < $diff || exit 1
  cp -r $S/test $S/foundry.toml $d/
  ln -sfn $M/../lib $d/lib
  cd $d || exit 1
  export FOUNDRY_INVARIANT_RUNS=25 FOUNDRY_INVARIANT_DEPTH=100 FOUNDRY_INVARIANT_SHRINK_RUN_LIMIT=0
  res=caught; fails=""
  for s in 1 7; do
    rm -rf cache/invariant cache/fuzz cache/test-failures
    o=$(timeout 300 $F test --threads 4 --fuzz-seed $s 2>&1 | sed 's/\x1b\[[0-9;]*m//g')
    r=$(echo "$o" | grep -E 'tests? passed' | tail -1 | grep -oE '[0-9]+ failed')
    if [ -z "$r" ]; then res=compile-error; fails=""; break; fi
    [ "$r" = "0 failed" ] && res=survived
    fails="$fails s$s:${r% failed}"
  done
  echo "$n $res$fails" >> $R
  rm -rf $d
}
export -f one
xargs -P 2 -L 1 bash -c 'one $0 $1' < "$3"
sort -o $R $R
echo "$L: $(awk '{print $2}' $R | sort | uniq -c | tr -s ' ' | tr '\n' ';')"
[ -e $W/PAUSED ] && echo "PAUSED at $(head -1 $W/PAUSED): battery fell"
exit 0
