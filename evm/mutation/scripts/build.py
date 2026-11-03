# Compiles the pool and hashes its bytecode, so mutants can be compared by what they compile to.
# SOLC defaults to the solc 0.8.38 that forge installs.
import os, json, hashlib, subprocess, shutil, tempfile, difflib
M = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(os.path.dirname(M), 'lib')
SOLC = os.environ.get('SOLC', os.path.expanduser('~/.local/share/svm/0.8.38/solc-0.8.38'))
W = tempfile.mkdtemp(prefix='amm-build-')
os.makedirs(f'{W}/src'); os.symlink(LIB, f'{W}/lib')


def contract():
    return subprocess.run([f'{M}/scripts/contract.sh'], check=True, capture_output=True, text=True).stdout


def build(text):
    """The sha256 of the pool's creation and runtime bytecode, or None if it does not compile."""
    open(f'{W}/src/ConstantProductPool.sol', 'w').write(text)
    r = subprocess.run([SOLC, '@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/',
                        '--base-path', '.', '--allow-paths', LIB, '--evm-version', 'osaka',
                        '--no-cbor-metadata', '--combined-json', 'bin,bin-runtime',
                        'src/ConstantProductPool.sol'], cwd=W, capture_output=True, text=True)
    if r.returncode:
        return None
    for k, v in json.loads(r.stdout)['contracts'].items():
        if k.endswith(':ConstantProductPool'):
            return hashlib.sha256((v['bin'] + '|' + v['bin-runtime']).encode()).hexdigest()
    return None


def diff(base, text):
    """text as a unified diff against base, for patch."""
    out = ''
    for line in difflib.unified_diff(base.splitlines(True), text.splitlines(True),
                                     'a/src/ConstantProductPool.sol', 'b/src/ConstantProductPool.sol'):
        out += line if line.endswith('\n') else line + '\n\\ No newline at end of file\n'
    return out


def done():
    shutil.rmtree(W)
