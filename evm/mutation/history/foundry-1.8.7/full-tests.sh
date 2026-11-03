#!/bin/bash
# Full suite, unchanged foundry.toml, one seed at a time, caches cleared before each.
cd /home/raduom/Spaces/amm-series/evm || exit 1
export XDG_CONFIG_HOME=$HOME/.config PATH="$HOME/.config/.foundry/bin:$PATH"
L=$HOME/.local/share/amm-series/foundry-upgrade
for s in 1 7; do
  rm -rf cache/invariant cache/fuzz
  date > $L/test-seed$s.log
  forge test --fuzz-seed $s >> $L/test-seed$s.log 2>&1
  echo "exit=$?" >> $L/test-seed$s.log
  date >> $L/test-seed$s.log
done
rm -rf cache/invariant cache/fuzz
