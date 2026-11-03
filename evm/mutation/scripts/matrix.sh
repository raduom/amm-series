#!/bin/bash
# usage: matrix.sh <label> <suite dir> <list of "name diff">
# Like score.sh, but records which tests fail for each bug under each seed:
# "<name> s1:<Contract.test,...> s7:<...>", or "<name> compile-error".
M=$(cd "$(dirname "$0")/.." && pwd)
export M L=$1 S=$(realpath "$2") WORK=${WORK:-/tmp/amm-mutation}
export W=$WORK/matrix/$1 R=$WORK/results/$1.txt F=${FORGE:-forge}
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
  line="$n"
  for s in 1 7; do
    rm -rf cache/invariant cache/fuzz cache/test-failures
    o=$(timeout 300 $F test --threads 4 --fuzz-seed $s 2>&1 | sed 's/\x1b\[[0-9;]*m//g')
    if ! echo "$o" | grep -qE 'tests? passed'; then line="$n compile-error"; break; fi
    failed=$(echo "$o" | awk '
      /^(Ran [0-9]+ tests? for|Encountered [0-9]+ failing tests? in) / { split($NF, a, ":"); c = a[2] }
      /^\[FAIL/ { k = split($0, p, "] "); t = p[k]; sub(/[( ].*/, "", t)
                   print c "." t }' | sort -u | paste -sd, -)
    line="$line s$s:$failed"
  done
  echo "$line" >> $R
  rm -rf $d
}
export -f one
xargs -P 2 -L 1 bash -c 'one $0 $1' < "$3"
sort -o $R $R
echo "$L: $(wc -l < $R) bugs"
[ -e $W/PAUSED ] && echo "PAUSED at $(head -1 $W/PAUSED): battery fell"
exit 0
