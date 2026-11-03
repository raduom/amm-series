#!/bin/bash
# Run Detect.t.sol on the unmutated contract and on each survivor, each in a fresh directory.
cd /tmp/amm-round6-opus
F=~/.config/.foundry/bin/forge
go() {
  name=$1; src=$2
  d=/tmp/amm-round6-opus/det-$name
  mkdir "$d" && cp -r "$src/src" "$src/test" "$src/foundry.toml" "$d/" && ln -s /home/raduom/Spaces/amm-series/evm/lib "$d/lib" && cp /tmp/amm-round6-opus/Detect.t.sol "$d/test/"
  echo "== $name"
  (cd "$d" && $F test --threads 4 --fuzz-seed 1 --match-path test/Detect.t.sol -vv 2>&1) | sed 's/\x1b\[[0-9;]*m//g' > "$d/detect.log"
  grep -E "^\[FAIL|tests passed|gold  |silver " "$d/detect.log" | cut -c1-170
}
:
for n in "$@"; do go "$n" "m-$n"; done
