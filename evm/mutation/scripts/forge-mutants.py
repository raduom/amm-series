# usage: forge-mutants.py <output of forge test --mutate> <out dir>
# forge test --mutate prints each mutant as a line and an edit, and does not keep the files.
# This writes each one back as a copy of the contract, m<number>.sol.
import os, re, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import contract

src = contract().split('\n')
out = sys.argv[2]; os.makedirs(out, exist_ok=True)
n = 0
for l in open(sys.argv[1]):
    m = re.match(r'^\[(\d+)/\d+\] Testing mutant: \S+?:(\d+): `(.*)` → `(.*)`$', re.sub(r'\x1b\[[0-9;]*m', '', l.rstrip('\n')))
    if not m: continue
    i, ln, a, b = int(m[1]), int(m[2]), m[3], m[4]
    s = list(src)
    assert s[ln - 1].count(a) == 1, (i, ln, a)
    s[ln - 1] = s[ln - 1].replace(a, b, 1)
    open(f'{out}/m{i:03d}.sol', 'w').write('\n'.join(s)); n += 1
print(n, 'written')
