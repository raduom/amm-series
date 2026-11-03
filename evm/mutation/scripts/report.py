# usage: report.py <results file of tool mutants>
# Each tool's outcomes, then every mutant not caught, with the lines it changes.
import os, sys, json, collections
M = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = {l.split()[0]: l.split()[1:] for l in open(sys.argv[1])}
mp = json.load(open(f'{M}/bugs/tools.json'))
for t in ['gambit', 'slither', 'umut', 'sumo', 'forge']:
    c = collections.Counter(R[h][0] for h, v in mp.items() if t in v and h in R)
    print(t, sum(t in v for v in mp.values()), dict(c))
for h, r in sorted(R.items()):
    if r[0] == 'caught': continue
    d = [x[0] + ' ' + ' '.join(x[1:].split()) for x in open(f'{M}/bugs/tools/{h}.diff').read().split('\n')[2:]
         if x.startswith(('+', '-'))]
    print(h, r[0], '/'.join(sorted(mp[h])), ' || '.join(x[:90] for x in d)[:230])
