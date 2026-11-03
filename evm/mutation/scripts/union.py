# usage: union.py <filter out dir> <bugs out dir>
# Merges every tool's kept mutants by bytecode. Writes one diff per distinct mutant to
# <bugs out dir>/tools/<hash>.diff, and <bugs out dir>/tools.json mapping each hash to the
# name each tool gave it.
import os, sys, json, collections
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import build, contract, diff, done

TOOLS = ['gambit', 'slither', 'umut', 'sumo', 'forge']
K, out = sys.argv[1], sys.argv[2]
base = contract()
os.makedirs(f'{out}/tools', exist_ok=True)
mp = collections.defaultdict(dict)
for t in TOOLS:
    for f in sorted(os.listdir(f'{K}/{t}')):
        text = open(f'{K}/{t}/{f}').read(); h = build(text)[:12]
        mp[h][t] = f[:-4]
        # a mutant several tools made keeps the first tool's copy, in the order of TOOLS
        if len(mp[h]) == 1:
            open(f'{out}/tools/{h}.diff', 'w').write(diff(base, text))
done()
json.dump(mp, open(f'{out}/tools.json', 'w'), indent=0)
print('unique', len(mp))
print('found by n tools', sorted(collections.Counter(len(v) for v in mp.values()).items()))
for t in TOOLS:
    print(t, sum(t in v for v in mp.values()), 'only this tool', sum(list(v) == [t] for v in mp.values()))
