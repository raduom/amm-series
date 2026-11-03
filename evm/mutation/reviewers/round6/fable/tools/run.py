import os, re, subprocess, sys, shutil, json
ROOT='/tmp/amm-round6-fable'
BASE=ROOT+'/base'
FORGE=os.path.expanduser('~/.config/.foundry/bin/forge')
SRC=open(BASE+'/src/ConstantProductPool.sol').read()
mutants=json.load(open(sys.argv[1]))
for name,pairs in mutants.items():
    d=f'{ROOT}/{name}'
    if os.path.exists(d+'/result.txt'):
        print(name, open(d+'/result.txt').read().strip()); continue
    os.makedirs(d+'/src',exist_ok=True)
    shutil.copytree(BASE+'/test', d+'/test', dirs_exist_ok=True)
    shutil.copy(BASE+'/foundry.toml', d)
    if not os.path.exists(d+'/lib'): os.symlink('/home/raduom/Spaces/amm-series/evm/lib', d+'/lib')
    s=SRC
    for a,b in pairs:
        assert s.count(a)==1,(name,a,s.count(a))
        s=s.replace(a,b)
    assert s!=SRC
    open(d+'/src/ConstantProductPool.sol','w').write(s)
    subprocess.run(['diff','-u','src/ConstantProductPool.sol',d+'/src/ConstantProductPool.sol'],cwd=BASE,stdout=open(d+'/mutant.diff','w'))
    res=[]
    for seed in ('1','2'):
        p=subprocess.run([FORGE,'test','--threads','4','--fuzz-seed',seed],cwd=d,capture_output=True,text=True)
        out=p.stdout+p.stderr
        open(d+f'/seed{seed}.log','w').write(out)
        m=re.search(r'(\d+) tests passed, (\d+) failed',out)
        if m: res.append(f'seed{seed}: {m.group(1)} passed, {m.group(2)} failed')
        else:
            cm=re.search(r'Compiler run failed|Error',out)
            res.append(f'seed{seed}: no summary ({"compile error" if cm else "unknown"})')
        if m and m.group(2)!='0': break
        if not m: break
    line=name+' | '+' ; '.join(res)
    open(d+'/result.txt','w').write(line+'\n')
    print(line, flush=True)
