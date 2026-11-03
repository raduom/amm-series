# usage: analyze.py <matrix results> [plan.json]
# Without a plan: for each test, the bugs no other test catches under a seed.
# With a plan {"remove": [...], "merge": {"old": "new"}}: the caught bugs the
# planned suite would lose, assuming a merged test catches what its parts did.
import json, sys
from collections import defaultdict

rows = {}
for line in open(sys.argv[1]):
    parts = line.split()
    name = parts[0]
    if parts[1:] == ['compile-error']:
        continue
    seeds = {}
    for p in parts[1:]:
        s, _, tests = p.partition(':')
        seeds[s] = set(t for t in tests.split(',') if t)
    rows[name] = seeds

caught = {n: s for n, s in rows.items() if all(s.values())}
print(f'{len(rows)} compiled, {len(caught)} caught under both seeds')

plan = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else None
if plan is None:
    sole = defaultdict(set)
    for n, seeds in caught.items():
        for s, tests in seeds.items():
            if len(tests) == 1:
                sole[next(iter(tests))].add(n)
    every = set().union(*(t for s in rows.values() for t in s.values()))
    for t in sorted(every, key=lambda t: (len(sole[t]), t)):
        print(f'{len(sole[t]):3} {t} {" ".join(sorted(sole[t]))}')
else:
    gone = set(plan.get('remove', []))
    merge = plan.get('merge', {})
    def kept(tests):
        return {merge.get(t, t) for t in tests if t not in gone}
    lost = [n for n, seeds in caught.items()
            if not all(kept(t) for t in seeds.values())]
    print(f'lost {len(lost)}: {" ".join(sorted(lost))}')
