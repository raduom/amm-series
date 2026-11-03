#!/bin/bash
# usage: score-corpus.sh <label> <dir holding test/ and foundry.toml>
L=$1; S=$2; W=/tmp/amm-corpus-$L; mkdir -p $W
{ for d in /tmp/amm-rebuilt/*/; do n=$(basename $d); echo "$n $d"; done; for d in $HOME/.local/share/amm-series/bugs/round5-copies/*/; do n=$(basename $d); echo "r5-$n $d"; done; } > $W/list
one() {
  n=$1; src=$2; d=$W/$n; mkdir -p $d/src
  cp $src/src/ConstantProductPool.sol $d/src/
  cp -r $S/test $S/foundry.toml $d/
  ln -sfn /home/raduom/Spaces/amm-series/evm/lib $d/lib
  cd $d || exit 1
  export FOUNDRY_INVARIANT_RUNS=25 FOUNDRY_INVARIANT_DEPTH=100 FOUNDRY_INVARIANT_SHRINK_RUN_LIMIT=0
  res=caught
  for s in 1 7; do
    mv cache/invariant cache/invariant.$s 2>/dev/null; mv cache/fuzz cache/fuzz.$s 2>/dev/null
    o=$($HOME/.config/.foundry/bin/forge test --threads 4 --fuzz-seed $s 2>&1 | sed 's/\x1b\[[0-9;]*m//g')
    r=$(echo "$o" | grep -E 'tests? passed' | tail -1 | grep -oE '[0-9]+ failed')
    if [ -z "$r" ]; then res=compile-error; break; fi
    [ "$r" = "0 failed" ] && { res=survived; break; }
  done
  echo "$n $res"
}
export -f one; export W S
awk '{print $1" "$2}' $W/list | xargs -P 2 -L 1 bash -c 'one $0 $1' > $W/results
sort $W/results > $HOME/.local/share/amm-series/corpus-$L.txt
awk '{print $2}' $W/results | sort | uniq -c
