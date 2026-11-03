#!/bin/bash
# Runs every Gambit mutant against the tests in evm/test, two seeds, two jobs at once.
# Prints the survivors and writes them to survivors.txt. A clean cache is used for every run.
E=$HOME/.local/share/amm-series/gambit-experiment
W=/tmp/amm-gambit-score
mkdir -p $W
ls $E/mutants/mutants | sort -n > $W/ids
one() {
  id=$1; d=$W/$id; mkdir -p $d/src
  cp $E/mutants/mutants/$id/src/ConstantProductPool.sol $d/src/
  cp -r $E/evm/test $E/evm/foundry.toml $d/
  ln -sfn /home/raduom/Spaces/amm-series/evm/lib $d/lib
  cd $d || exit 1
  export FOUNDRY_INVARIANT_RUNS=25 FOUNDRY_INVARIANT_DEPTH=100 FOUNDRY_INVARIANT_SHRINK_RUN_LIMIT=0
  res=caught
  for s in 1 7; do
    mv cache/invariant cache/invariant.$s 2>/dev/null; mv cache/fuzz cache/fuzz.$s 2>/dev/null
    r=$($HOME/.config/.foundry/bin/forge test --threads 4 --fuzz-seed $s 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E 'tests? passed' | tail -1 | grep -oE '[0-9]+ failed')
    case "$r" in "0 failed") res=survived; break;; "") res=error;; esac
  done
  echo "$id $res"
}
export -f one; export E W
xargs -P 2 -I{} bash -c 'one {}' < $W/ids > $W/results
sort -n $W/results > $E/results.txt
awk '$2!="caught"' $E/results.txt > $E/survivors.txt
echo "$(grep -c caught $E/results.txt) caught, $(grep -c survived $E/results.txt) survived, $(grep -c error $E/results.txt) errors, of $(wc -l < $E/results.txt)"
