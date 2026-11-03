import subprocess, shutil, os, json, sys, re
root='/home/raduom/Spaces/amm-series/evm'
forge=os.path.expanduser('~/.config/.foundry/bin/forge')
work=sys.argv[1]
for n in ['src','test']: shutil.copytree(f'{root}/{n}',f'{work}/{n}')
shutil.copy(f'{root}/foundry.toml',work)
os.symlink(f'{root}/lib',f'{work}/lib')
os.chdir(work)
src=open('src/ConstantProductPool.sol').read()
PRICE='amountOut = reserveOut * amountIn / (reserveIn + amountIn);'
GUARD='''if (amountOut == 0 || amountOut < minAmountOut) {
            revert OutputTooSmall();
        }'''
STATE=('uint256 public reserve1;','uint256 public reserve1;\n    uint256 swapCount;')
OUT='tokenOut.safeTransfer(msg.sender, amountOut);'
INTOK='tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);'
def after(text,add): return [(text,text+'\n        '+add)]
M={
 # new in this review
 'G1 one less from 2nd swap':[STATE]+after(GUARD,'if (swapCount++ > 0) amountOut -= 1;'),
 'G1 1% less from 2nd swap':[STATE]+after(GUARD,'if (swapCount++ > 0) amountOut -= amountOut / 100;'),
 'G1 one less from 3rd swap':[STATE]+after(GUARD,'if (++swapCount >= 3) amountOut -= 1;'),
 'G1 one less on small pools':after(GUARD,'if (reserveOut < 1e6 && amountOut > 1) amountOut -= 1;'),
 'G1 refuse after 3 swaps':[STATE]+after(GUARD,'if (swapCount++ > 3) revert OutputTooSmall();'),
 'G2 book and pay one less':after(GUARD,'uint256 paid = (amountIn == 3 || amountIn == 100 || amountIn == 400 || amountOut <= 1) ? amountOut : amountOut - 1;')+[('reserveOut - amountOut','reserveOut - paid'),(OUT,'tokenOut.safeTransfer(msg.sender, paid);')],
 'G2 transfer one less':[(OUT,'tokenOut.safeTransfer(msg.sender, amountOut - (amountOut > 1 ? 1 : 0));')],
 'G2 uint96 payout':[(OUT,'tokenOut.safeTransfer(msg.sender, uint96(amountOut));')],
 'G2 uint96 payout, booked too':[('reserveOut - amountOut','reserveOut - uint96(amountOut)'),(OUT,'tokenOut.safeTransfer(msg.sender, uint96(amountOut));')],
 'G2 pay owner from 2nd swap':[STATE,(OUT,'tokenOut.safeTransfer(swapCount++ > 0 ? owner : msg.sender, amountOut);')],
 'G2 pay the minimum':[(OUT,'tokenOut.safeTransfer(msg.sender, minAmountOut != 0 ? minAmountOut : amountOut);'),('reserveOut - amountOut','reserveOut - (minAmountOut != 0 ? minAmountOut : amountOut)')],
 'G2 take one less in':[(INTOK,'tokenIn.safeTransferFrom(msg.sender, address(this), amountIn - (amountIn > 1 ? 1 : 0));')],
 'G2 reserve drifts on 2nd swap':[STATE,('reserve0 = reserveIn + amountIn;','reserve0 = reserveIn + amountIn + (swapCount++ > 0 ? 1 : 0);')],
 'G4 uint240 truncation':[(PRICE,'amountOut = uint256(uint240(reserveOut * amountIn)) / (reserveIn + amountIn);')],
 'G5 indexed removed':[('address indexed trader','address trader')],
 'G5 event field order':[('emit Swap(msg.sender, zeroForOne, amountIn, amountOut);','emit Swap(msg.sender, zeroForOne, amountOut, amountIn);')],
 # from the last review
 'F1 no identical-token check':[('if (address(token0_) == address(token1_)) revert IdenticalTokens();','')],
 'F2 refuse a reserve window':after(PRICE,'if (reserveIn > type(uint96).max && reserveIn <= type(uint112).max) revert OutputTooSmall();'),
 'F2 refuse a window, string':after(PRICE,'if (reserveIn > type(uint96).max && reserveIn <= type(uint112).max) revert("no");'),
 'F2 refuse small trades':after(PRICE,'if (amountIn * 1000 < reserveIn) revert OutputTooSmall();'),
 'F6 min only if out + 1':[('amountOut == 0 || amountOut < minAmountOut','amountOut == 0 || amountOut + 1 == minAmountOut')],
 'F6 min 0 or exact only':[('amountOut == 0 || amountOut < minAmountOut','amountOut == 0 || (minAmountOut != 0 && minAmountOut != amountOut)')],
 'F7 denominator + 1':[(PRICE,'amountOut = reserveOut * amountIn / (reserveIn + amountIn + 1);')],
 'F7 hidden 0.1% fee':[(PRICE,'amountOut = reserveOut * amountIn * 999 / (reserveIn * 1000 + amountIn * 999);')],
 'F8 event hard-coded true':[('emit Swap(msg.sender, zeroForOne,','emit Swap(msg.sender, true,')],
 'round up':[(PRICE,'amountOut = (reserveOut * amountIn + reserveIn + amountIn - 1) / (reserveIn + amountIn);')],
 'denominator - 1':[(PRICE,'amountOut = reserveOut * amountIn / (reserveIn + amountIn - 1);')],
 'ignore minAmountOut':[('amountOut == 0 || amountOut < minAmountOut','amountOut == 0')],
 'off by one on minimum':[('amountOut < minAmountOut','amountOut + 1 < minAmountOut')],
 'allow zero output':[('amountOut == 0 || amountOut','amountOut')],
 'else branch swapped':[('reserve0 = reserveOut - amountOut;\n            reserve1 = reserveIn + amountIn;','reserve1 = reserveOut - amountOut;\n            reserve0 = reserveIn + amountIn;')],
 'reserves swapped':[('zeroForOne ? (reserve0, reserve1) : (reserve1, reserve0)','zeroForOne ? (reserve1, reserve0) : (reserve0, reserve1)')],
 'tokens swapped':[('zeroForOne ? (token0, token1) : (token1, token0)','zeroForOne ? (token1, token0) : (token0, token1)')],
 'skip pulling tokens in':[(INTOK,'')],
 'pay out double':[(OUT,'tokenOut.safeTransfer(msg.sender, amountOut * 2);')],
 'no owner check':[('if (msg.sender != owner) revert NotOwner();','')],
 'initialize twice':[('if (reserve0 != 0 || reserve1 != 0) revert AlreadyInitialized();','')],
 'no empty pool check':[('if (reserve0 == 0 || reserve1 == 0) revert EmptyPool();','')],
 'check order swapped':[('if (amountIn == 0) revert AmountNotPositive();\n        if (reserve0 == 0 || reserve1 == 0) revert EmptyPool();','if (reserve0 == 0 || reserve1 == 0) revert EmptyPool();\n        if (amountIn == 0) revert AmountNotPositive();')],
}
blk=re.search(r'        if \(zeroForOne\) \{\n            reserve0 = reserveIn.*?\n        \}\n',src,re.S).group(0)
DEFERRED={
 'G3 unchecked token calls (ch5)':[('.safeTransferFrom(','.transferFrom('),('.safeTransfer(','.transfer(')],
 'G6 price from balanceOf (ch3)':[('zeroForOne ? (reserve0, reserve1) : (reserve1, reserve0)','zeroForOne ? (token0.balanceOf(address(this)), token1.balanceOf(address(this))) : (token1.balanceOf(address(this)), token0.balanceOf(address(this)))')],
 'G9 pay before taking (ch5)':[(INTOK+'\n        '+OUT,OUT+'\n        '+INTOK)],
 'G9 reserves after transfers (ch5)':[(blk,''),(OUT,OUT+'\n'+blk)],
 'G13 public sweep (security)':[('    /// @notice Pay `amountIn` of one token','    function sweep() external {\n        token0.safeTransfer(msg.sender, token0.balanceOf(address(this)));\n        token1.safeTransfer(msg.sender, token1.balanceOf(address(this)));\n    }\n\n    /// @notice Pay `amountIn` of one token')],
}
env=dict(os.environ,FOUNDRY_INVARIANT_RUNS='25',FOUNDRY_INVARIANT_DEPTH='100',FOUNDRY_INVARIANT_SHRINK_RUN_LIMIT='0')
def run(seed):
    for c in ['cache/invariant','cache/fuzz','cache/test-failures']: shutil.rmtree(c,ignore_errors=True)
    r=subprocess.run([forge,'test','--json','--fuzz-seed',seed],capture_output=True,text=True,env=env)
    try: d=json.loads(r.stdout)
    except Exception: return None,(r.stdout+r.stderr)[-400:]
    f=[]
    for suite,v in d.items():
        for name,res in v['test_results'].items():
            if res['status']!='Success': f.append(suite.split(':')[-1][:5]+'/'+name.split('(')[0])
    return sorted(f),''
base,e=run('0x1234'); print('BASELINE failures:',base,e,flush=True)
def apply(pairs):
    s=src
    for a,b in pairs:
        assert a in s,a
        s=s.replace(a,b)
    open('src/ConstantProductPool.sol','w').write(s)
surv=[]
for name,pairs in M.items():
    apply(pairs); tot=[]
    for seed in ['0x1234','0x5678']:
        f,e=run(seed)
        if f is None: print('RUN ERROR',name,e,flush=True); f=[]
        tot.append(f)
    inv=sorted(set(x.split('/')[1] for x in tot[0] if 'invariant_' in x))
    ok=all(tot)
    if not ok: surv.append(name)
    print(f"{'caught  ' if ok else 'SURVIVED'} | {name} | failed {len(tot[0])},{len(tot[1])} | invariants {len(inv)}",flush=True)
print('---- deferred: expected to survive')
for name,pairs in DEFERRED.items():
    apply(pairs); tot=[]
    for seed in ['0x1234','0x5678']:
        f,e=run(seed)
        if f is None: print('RUN ERROR',name,e,flush=True); f=[]
        tot.append(f)
    print(f"{'caught  ' if any(tot) else 'survives'} | {name} | failed {len(tot[0])},{len(tot[1])}",flush=True)
print('survivors of must-catch:',surv,'of',len(M))
