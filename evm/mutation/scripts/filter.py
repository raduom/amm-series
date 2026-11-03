# usage: filter.py <tool> <out dir> <mutant .sol file>...
# Compiles each of a tool's mutants and drops those that fail, or that give the same
# bytecode as the contract or as an earlier mutant. Copies the rest to <out dir>/<tool>/.
import os, sys, shutil, collections
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import build, contract, done

tool, out, files = sys.argv[1], sys.argv[2], sorted(sys.argv[3:])
orig = build(contract()); assert orig
seen = set(); c = collections.Counter()
K = f'{out}/{tool}'; shutil.rmtree(K, ignore_errors=True); os.makedirs(K)
for f in files:
    h = build(open(f).read())
    if h is None: c['does not compile'] += 1
    elif h == orig: c['same bytecode as the contract'] += 1
    elif h in seen: c['duplicate'] += 1
    else:
        seen.add(h); c['kept'] += 1
        # name a mutant after its file, or after its folder when every file has the same name
        n = os.path.basename(f)
        if n == 'ConstantProductPool.sol':
            n = os.path.basename(os.path.dirname(os.path.dirname(f)))
        n = n.replace('ConstantProductPool.', '').replace('.sol', '')
        shutil.copy(f, f'{K}/{n}.sol')
done()
print(tool, len(files), dict(c))
