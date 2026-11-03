# Writes every hand-made bug as a plain contract copy, so one runner can score them all.
# usage: python3 build-corpus.py   (corpus goes to ../bugs/corpus/<set>/<name>/src/)
import os,re,shutil
H=os.path.expanduser('~/.local/share/amm-series')
C=f'{H}/bugs/corpus'
SRC=f'{H}/tool-experiment/base/src/ConstantProductPool.sol'
def put(s,n,text=None,copy=None):
    d=f'{C}/{s}/{re.sub(r"[^A-Za-z0-9._-]+","-",n)}/src'; os.makedirs(d,exist_ok=True)
    t=f'{d}/ConstantProductPool.sol'
    if copy: shutil.copy(copy,t)
    else: open(t,'w').write(text)
shutil.rmtree(C,ignore_errors=True)
# rounds 1 and 2: the edit lists inside earlier44.py
t=open(f'{H}/bugs/earlier44.py').read()
body=t[t.index("PRICE='amountOut"):t.index('def run(seed)')]
src=open(SRC).read(); g={'re':re,'os':os,'src':src}
exec(body,g)
for name,pairs in g['M'].items():
    s=src
    for a,b in pairs:
        assert a in s,a
        s=s.replace(a,b)
    put('earlier',name,s)
# Gambit
m=f'{H}/bugs/gambit/mutants'
for i in os.listdir(m): put('gambit',i,copy=f'{m}/{i}/src/ConstantProductPool.sol')
# rounds 3 to 5
for s,d,p in (('rounds345',f'{H}/bugs/rebuilt',''),('rounds345',f'{H}/bugs/round5-copies','r5-')):
    for n in os.listdir(d): put(s,p+n,copy=f'{d}/{n}/src/ConstantProductPool.sol')
# round 6: the 29 distinct survivors
for l in open(f'{H}/corpus-r6-current71.txt'):
    n=l.split()[0]; put('round6',n,copy=f'/tmp/amm-r6/bugs/{n}/src/ConstantProductPool.sol')
for s in sorted(os.listdir(C)): print(s,len(os.listdir(f'{C}/{s}')))
