#!/usr/bin/env python3
"""One forge at a time, one fresh directory per mutant. Never touches the repository."""
import os, shutil, subprocess, sys, re, difflib

ROOT = '/tmp/amm-round6-opus'
BASE = f'{ROOT}/base'
LIB = '/home/raduom/Spaces/amm-series/evm/lib'
FORGE = os.path.expanduser('~/.config/.foundry/bin/forge')
BUGS = os.path.expanduser('~/.local/share/amm-series/bugs/round6')

IMP = 'import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";'
META = 'import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";'
P0 = 'token0.safeTransferFrom(msg.sender, address(this), amount0);'
P1 = 'token1.safeTransferFrom(msg.sender, address(this), amount1);'
PIN = 'tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);'
POUT = 'tokenOut.safeTransfer(msg.sender, amountOut);'
PRICE = 'amountOut = reserveOut * amountIn / (reserveIn + amountIn);'
EMPTY = 'if (reserve0 == 0 || reserve1 == 0) revert EmptyPool();'
ZERO = 'if (amountIn == 0) revert AmountNotPositive();'
GUARD = 'if (amountOut == 0 || amountOut < minAmountOut) {'
INIT = 'if (reserve0 != 0 || reserve1 != 0) revert AlreadyInitialized();'
OWNER = 'owner = msg.sender;'
R1 = 'uint256 public reserve1;'
EMIT = 'emit Swap(msg.sender, zeroForOne, amountIn, amountOut);'

M = {
 # surviving candidates
 'init-unlimited-skips-payment': [
   (P0, 'if (token0.allowance(msg.sender, address(this)) != type(uint256).max) {\n            ' + P0 + '\n        }'),
   (P1, 'if (token1.allowance(msg.sender, address(this)) != type(uint256).max) {\n            ' + P1 + '\n        }')],
 'init-unlimited-takes-balance': [
   (P0, 'token0.safeTransferFrom(msg.sender, address(this), token0.allowance(msg.sender, address(this)) == type(uint256).max ? token0.balanceOf(msg.sender) : amount0);'),
   (P1, 'token1.safeTransferFrom(msg.sender, address(this), token1.allowance(msg.sender, address(this)) == type(uint256).max ? token1.balanceOf(msg.sender) : amount1);')],
 'short-trader-unlimited-pays-what-they-have': [
   (PIN, 'uint256 pull = amountIn;\n        if (tokenIn.allowance(msg.sender, address(this)) == type(uint256).max) {\n            uint256 held = tokenIn.balanceOf(msg.sender);\n            if (held < pull) pull = held;\n        }\n        tokenIn.safeTransferFrom(msg.sender, address(this), pull);')],
 'short-trader-spare-approval-pays-what-they-have': [
   (PIN, 'uint256 pull = amountIn;\n        if (tokenIn.allowance(msg.sender, address(this)) > amountIn) {\n            uint256 held = tokenIn.balanceOf(msg.sender);\n            if (held < pull) pull = held;\n        }\n        tokenIn.safeTransferFrom(msg.sender, address(this), pull);')],
 'later-block-fee': [
   (R1, R1 + '\n    uint256 private lastBlock;'),
   ('reserve0 = amount0;', 'lastBlock = block.number;\n        reserve0 = amount0;'),
   (PRICE, PRICE + '\n        if (block.number != lastBlock) {\n            lastBlock = block.number;\n            amountOut -= amountOut / 1000;\n        }')],
 'init-only-in-deployment-block': [
   ('address public immutable owner;', 'address public immutable owner;\n    uint256 private immutable deployedAt = block.number;'),
   (INIT, INIT + '\n        if (block.number != deployedAt) revert NotOwner();')],
 'decimals-scale-the-input': [
   (IMP, IMP + '\n' + META),
   (PRICE, 'uint256 scaledIn = amountIn * 10 ** (18 - IERC20Metadata(address(zeroForOne ? token0 : token1)).decimals());\n        amountOut = reserveOut * scaledIn / (reserveIn + scaledIn);')],
 'decimals-must-match': [
   (IMP, IMP + '\n' + META),
   ('if (address(token0_) == address(token1_)) revert IdenticalTokens();',
    'if (address(token0_) == address(token1_)) revert IdenticalTokens();\n        if (IERC20Metadata(address(token0_)).decimals() != IERC20Metadata(address(token1_)).decimals()) revert IdenticalTokens();')],
 'empty-judged-by-sum': [(EMPTY, 'if (reserve0 + reserve1 == 0) revert EmptyPool();')],
 'minimum-checked-before-amount': [
   (ZERO, 'if (reserve0 != 0 && minAmountOut > (zeroForOne ? reserve1 : reserve0)) revert OutputTooSmall();\n        ' + ZERO)],
 'constructor-approves-owner': [
   (OWNER, OWNER + '\n        token0_.approve(msg.sender, type(uint256).max);\n        token1_.approve(msg.sender, type(uint256).max);')],
 'plain-ether-accepted': [
   ('    /// @notice Provide the pool\'s liquidity, once.', '    receive() external payable {}\n\n    /// @notice Provide the pool\'s liquidity, once.')],
 'init-skips-pull-when-already-held': [
   (P0, 'if (token0.balanceOf(address(this)) < amount0) {\n            ' + P0 + '\n        }'),
   (P1, 'if (token1.balanceOf(address(this)) < amount1) {\n            ' + P1 + '\n        }')],
 'init-books-donation-above-amount': [
   ('reserve0 = amount0;', 'uint256 held0 = token0.balanceOf(address(this));\n        reserve0 = held0 > amount0 ? held0 : amount0;')],
 'large-balance-pays-a-fee': [
   (PRICE, PRICE + '\n        {\n            IERC20 paid = zeroForOne ? token0 : token1;\n            if (paid.balanceOf(msg.sender) / 2 > amountIn) amountOut -= amountOut / 1000;\n        }')],

 # controls: these should all be detected
 'ctl-unlimited-skips-payment': [(PIN, 'if (tokenIn.allowance(msg.sender, address(this)) != type(uint256).max) {\n            ' + PIN + '\n        }')],
 'ctl-donation-covers-the-pull': [(PIN, 'if (tokenIn.balanceOf(address(this)) - (zeroForOne ? reserve0 - amountIn : reserve1 - amountIn) < amountIn) {\n            ' + PIN + '\n        }')],
 'ctl-funds-before-minimum': [(GUARD, 'if (tokenIn0().balanceOf(msg.sender) >= 0) tokenIn0();\n        ' + GUARD)],
 'ctl-contract-callers-paid-less': [(PRICE, PRICE + '\n        if (msg.sender != owner && msg.sender.code.length != 0) amountOut -= amountOut / 1000;')],
 'ctl-wallet-owner-skips-minimum': [(GUARD, 'if (amountOut == 0 || (amountOut < minAmountOut && !(msg.sender == owner && tx.origin == owner))) {')],
 'ctl-pays-to-origin': [(POUT, 'tokenOut.safeTransfer(tx.origin, amountOut);')],
 'ctl-init-guard-by-sum': [(INIT, 'if (reserve0 + reserve1 != 0) revert AlreadyInitialized();')],
}
del M['ctl-funds-before-minimum']


def run(cmd, cwd, log):
    with open(log, 'a') as f:
        f.write(f'$ {" ".join(cmd)}\n'); f.flush()
        p = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        f.write(p.stdout)
    return p.returncode, p.stdout


def summary(out):
    tail = [l for l in out.splitlines() if 'tests passed' in l or 'Ran ' in l and 'suites' in l]
    fails = sorted(set(re.findall(r'\[FAIL[^\]]*\]\s*(\S+\(.*?\))', re.sub(r'\x1b\[[0-9;]*m', '', out))))
    return (tail[-1] if tail else 'no summary'), fails


def main(names):
    src0 = open(f'{BASE}/src/ConstantProductPool.sol').read()
    for name in names:
        d = f'{ROOT}/m-{name}'
        n = 2
        while os.path.exists(d):
            d = f'{ROOT}/m-{name}-{n}'; n += 1
        os.makedirs(d)
        for s in ('src', 'test'):
            shutil.copytree(f'{BASE}/{s}', f'{d}/{s}')
        shutil.copy(f'{BASE}/foundry.toml', d)
        os.symlink(LIB, f'{d}/lib')
        src = src0
        for a, b in M[name]:
            assert src.count(a) >= 1, (name, a)
            src = src.replace(a, b, 1)
        open(f'{d}/src/ConstantProductPool.sol', 'w').write(src)
        diff = ''.join(difflib.unified_diff(src0.splitlines(True), src.splitlines(True),
                                            'a/src/ConstantProductPool.sol', 'b/src/ConstantProductPool.sol'))
        open(f'{d}/mutant.diff', 'w').write(diff)
        log = f'{d}/run.log'
        rc, out = run([FORGE, 'test', '--threads', '4', '--fuzz-seed', '1',
                       '--match-contract', 'ConstantProductPoolTest', '--fail-fast'], d, log)
        s, fails = summary(out)
        if 'Compiler run failed' in out or ('Error' in out and 'tests passed' not in out and 'Ran ' not in out):
            print(f'{name}: COMPILE FAILED\n' + out[-1500:], flush=True); continue
        if rc != 0:
            print(f'{name}: DETECTED by unit tests: {fails[:4]}', flush=True); continue
        rc1, out1 = run([FORGE, 'test', '--threads', '4', '--fuzz-seed', '1'], d, log)
        s1, fails1 = summary(out1)
        if rc1 != 0:
            print(f'{name}: DETECTED seed 1: {fails1[:4]}', flush=True); continue
        rc2, out2 = run([FORGE, 'test', '--threads', '4', '--fuzz-seed', '2'], d, log)
        s2, fails2 = summary(out2)
        if rc2 != 0:
            print(f'{name}: DETECTED seed 2 only: {fails2[:4]} (seed 1: {s1})', flush=True); continue
        shutil.copy(f'{d}/mutant.diff', f'{BUGS}/opus-{name}.diff')
        print(f'{name}: SURVIVED\n   seed 1: {s1}\n   seed 2: {s2}\n   dir: {d}', flush=True)


if __name__ == '__main__':
    main(sys.argv[1:])
