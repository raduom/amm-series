# usage: suites.py <out dir>
# Builds every suite the results were scored with, each a folder holding test/ and
# foundry.toml, with lib linked and the clean contract in src/ so forge test runs there too:
#   base     the first 30 tests, from commit d1dbe9f, which the tool comparison started from
#   current  the 71 tests the tools were compared against, from commit f814f4f
#   step1    current with the tests that closed the gaps, before the overlap pass
#   final    the suite after the overlap pass, from commit 696973f
#   trim     the suite after the deep trim, from commit 4c435a3
#   gambit, slither, sumo, forge, umut, all
#            base with only the tests each tool's own survivors asked for (T below)
import os, shutil, subprocess, sys
M = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVM = os.path.dirname(M)
FILES = ['ConstantProductPool.t.sol', 'ConstantProductPool.invariant.t.sol', 'TestToken.sol']


def show(commit, path):
    return subprocess.run(['git', '-C', M, 'show', f'{commit}:evm/{path}'],
                          check=True, capture_output=True, text=True).stdout


def suite(d, commit):
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(f'{d}/test'); os.makedirs(f'{d}/src')
    for f in FILES:
        open(f'{d}/test/{f}', 'w').write(show(commit, f'test/{f}'))
    open(f'{d}/foundry.toml', 'w').write(show(commit, 'foundry.toml'))
    open(f'{d}/src/ConstantProductPool.sol', 'w').write(show('b2b1365', 'src/ConstantProductPool.sol'))
    os.symlink(f'{EVM}/lib', f'{d}/lib')


T={
'A':'''    function test_ConstructorRefusesTheSameTokenTwice() public {
        vm.expectRevert(ConstantProductPool.IdenticalTokens.selector);
        new ConstantProductPool(gold, gold);
    }
''',
'B':'''    function test_ConstructorTakesTokensInEitherOrder() public {
        new ConstantProductPool(gold, silver);
        new ConstantProductPool(silver, gold);
    }
''',
'C':'''    function test_InitializeRefusesAnAddressAboveTheOwner() public {
        vm.prank(address(type(uint160).max));
        vm.expectRevert(ConstantProductPool.NotOwner.selector);
        pool.initialize(1, 1);
    }
''',
'D':'''    function test_SwapRefusesToPayNothingWithAMinimum() public {
        stock(1000, 1000);
        assertRefused(
            true, 1, 1, ConstantProductPool.OutputTooSmall.selector
        );
    }
''',
'E':'''    function test_SwapWorksOnAReserveOfOne() public {
        stock(1, 1000);
        assertEq(trade(true, 1, 0), 500);
    }
''',
'F':'''    function test_SwapEventIndexesTheTrader() public {
        stock(1000, 1000);
        vm.recordLogs();
        trade(true, 100, 0);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter != address(pool)) continue;
            assertEq(logs[i].topics.length, 2);
            assertEq(logs[i].topics[1], bytes32(uint256(uint160(trader))));
            return;
        }
        fail();
    }
''',
'G':'''    function test_PoolShowsItsTokensAndOwner() public view {
        assertEq(address(pool.token0()), address(gold));
        assertEq(address(pool.token1()), address(silver));
        assertEq(pool.owner(), address(this));
    }
''',
'H':'''    function test_InitializeChecksOwnerBeforeAnythingElse() public {
        stock(1000, 1000);
        vm.prank(trader);
        vm.expectRevert(ConstantProductPool.NotOwner.selector);
        pool.initialize(1, 1);
    }

    function test_InitializeRefusesASecondCallBeforeItsAmounts() public {
        stock(1000, 1000);
        vm.expectRevert(ConstantProductPool.AlreadyInitialized.selector);
        pool.initialize(0, 0);
    }
''',
'I':'''    function test_InitializeTakesGoldFirst() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(pool),
                0,
                3
            )
        );
        pool.initialize(3, 4);
    }
''',
}
S = {'gambit': 'A', 'slither': 'A', 'sumo': 'AE', 'forge': 'ABCD', 'umut': 'ABCEFGHI', 'all': 'ABCDEFGHI'}
out = sys.argv[1]
for name, commit in [('base', 'd1dbe9f'), ('current', 'f814f4f'), ('step1', 'f814f4f'), ('final', '696973f'), ('trim', '4c435a3')]:
    suite(f'{out}/{name}', commit)
subprocess.run(['patch', '-s', '-p1', '-d', f'{out}/step1', '-i', f'{M}/suites/step1.diff'], check=True)
for name, keys in S.items():
    d = f'{out}/{name}'
    suite(d, 'd1dbe9f')
    p = f'{d}/test/ConstantProductPool.t.sol'
    s = open(p).read()
    assert s.endswith('}\n')
    s = s[:-2] + ''.join('\n' + T[k] for k in keys) + '}\n'
    if 'F' in keys:
        s = s.replace('import {Test} from "forge-std/Test.sol";',
                      'import {Test} from "forge-std/Test.sol";\nimport {Vm} from "forge-std/Vm.sol";')
    open(p, 'w').write(s)
for name in ['base', 'current', 'step1', 'final', 'trim', *S]:
    n = sum(open(f'{out}/{name}/test/{f}').read().count('\n') for f in FILES)
    print(f'{name}: {n} lines')
