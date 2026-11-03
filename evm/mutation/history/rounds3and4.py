# Rebuilds the mutants of review rounds 3 and 4 from the reviewers' reports.
# usage: rounds3and4.py <pool source> <output dir>
import os,sys
src=open(sys.argv[1]).read(); out=sys.argv[2]
PRICE='amountOut = reserveOut * amountIn / (reserveIn + amountIn);'
GUARD='''if (amountOut == 0 || amountOut < minAmountOut) {
            revert OutputTooSmall();
        }'''
EMPTY='if (reserve0 == 0 || reserve1 == 0) revert EmptyPool();'
ZERO='if (amountIn == 0) revert AmountNotPositive();'
OWNER='if (msg.sender != owner) revert NotOwner();'
INIT='if (reserve0 != 0 || reserve1 != 0) revert AlreadyInitialized();'
AMT='if (amount0 == 0 || amount1 == 0) revert AmountNotPositive();'
INTOK='tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);'
OUT='tokenOut.safeTransfer(msg.sender, amountOut);'
EV='emit Swap(msg.sender, zeroForOne, amountIn, amountOut);'
TOK='''(IERC20 tokenIn, IERC20 tokenOut) =
            zeroForOne ? (token0, token1) : (token1, token0);'''
T0='token0.safeTransferFrom(msg.sender, address(this), amount0);'
T1='token1.safeTransferFrom(msg.sender, address(this), amount1);'
IMP='import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";\n'
ERR='import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";\n'
R1='uint256 public reserve1;'
CTOR='''token0 = token0_;
        token1 = token1_;'''
def state(d): return (R1,R1+'\n    '+d)
M={
'r3-allowance-precheck':[(IMP,IMP+ERR),(INTOK,'uint256 approved = tokenIn.allowance(msg.sender, address(this));\n        if (approved < amountIn) revert IERC20Errors.ERC20InsufficientAllowance(address(this), approved, amountIn);\n        tokenIn.safeTransferFrom(msg.sender, address(this), approved);')],
'r3-init-same-amounts':[(INIT,'if (reserve0 == amount0 && reserve1 == amount1) revert AlreadyInitialized();')],
'r3-min-total-balance':[('amountOut == 0 || amountOut < minAmountOut','amountOut == 0 || amountOut + (zeroForOne ? token1 : token0).balanceOf(msg.sender) < minAmountOut')],
'r3-zero-one-direction':[(ZERO,'if (zeroForOne && amountIn == 0) revert AmountNotPositive();')],
'r3-size-guard':[(ZERO,ZERO+'\n        if (amountIn > type(uint128).max) revert AmountNotPositive();')],
'r3-event-twice':[(EV,EV+'\n        '+EV)],
'r3-init-order':[(OWNER,AMT),(AMT+'\n\n','if (msg.sender != owner) revert NotOwner();\n\n')],
'r3-owner-swaps-free':[(INTOK,'if (msg.sender != owner) {\n            '+INTOK+'\n        }')],
'r3-empty-one-direction':[(EMPTY,'if (zeroForOne) {\n            '+EMPTY+'\n        }')],
'r3-event-reserve-out-twice':[(EV,'emit Swap(msg.sender, zeroForOne, amountIn, reserveOut * amountIn / (reserveOut + amountIn));')],
'r3-owner-cannot-swap':[(ZERO,'if (msg.sender == owner) revert NotOwner();\n        '+ZERO)],
'r3-signed-amount':[(ZERO,'if (int256(amountIn) <= 0) revert AmountNotPositive();')],
'r3-event-first-swap-only':[state('uint256 private swaps;'),(EV,'if (swaps == 0) {\n            '+EV+'\n        }\n        swaps = 1;')],
'r3-minimum-from-opening-reserves':[state('uint256 private open0;\n    uint256 private open1;'),('reserve1 = amount1;','reserve1 = amount1;\n        open0 = amount0;\n        open1 = amount1;'),('amountOut == 0 || amountOut < minAmountOut','amountOut == 0 || (zeroForOne ? open1 : open0) * amountIn / ((zeroForOne ? open0 : open1) + amountIn) < minAmountOut')],
'r3-minimum-from-trader-balance':[(GUARD+'\n',''),(OUT,OUT+'\n        uint256 received = tokenOut.balanceOf(msg.sender);\n        if (received == 0 || received < minAmountOut) revert OutputTooSmall();')],
'r3-cap-at-balance':[(ZERO,'uint256 held = (zeroForOne ? token0 : token1).balanceOf(msg.sender);\n        if (amountIn > held) amountIn = held;\n        '+ZERO)],
'r3-cumulative-minimum':[state('uint256 public totalOut;'),('amountOut == 0 || amountOut < minAmountOut','amountOut == 0 || (totalOut += amountOut) < minAmountOut')],
'r3-event-cumulative':[state('uint256 public totalIn;'),(EV,'totalIn += amountIn;\n        emit Swap(msg.sender, zeroForOne, totalIn, amountOut);')],
'r3-event-direction-old':[(EV,'emit Swap(msg.sender, reserve0 > reserveIn, amountIn, amountOut);')],
'r3-event-direction-reserves':[(EV,'emit Swap(msg.sender, reserve0 > reserve1, amountIn, amountOut);')],
'r3-event-reserve-in-twice':[(EV,'emit Swap(msg.sender, zeroForOne, amountIn, reserveIn * amountIn / (reserveIn + amountIn));')],
'r3-excess-allowance':[(INTOK,'uint256 allowed = tokenIn.allowance(msg.sender, address(this));\n        tokenIn.safeTransferFrom(msg.sender, address(this), allowed > amountIn ? allowed : amountIn);')],
'r3-garbage-from-third':[state('uint256 private swapCount;'),(OUT,OUT+'\n        if (++swapCount >= 3) amountOut = type(uint256).max;')],
'r3-price-through-k':[(PRICE,'uint256 k = reserveIn * reserveOut;\n        uint256 grown = reserveIn + amountIn;\n        amountOut = reserveOut - ((k - 1) / grown + 1);')],
'r3-refusals-one-way':[(ZERO+'\n        '+EMPTY,'if (zeroForOne) {\n            '+ZERO+'\n            '+EMPTY+'\n        }')],
'r3-event-inverted':[(EV,'emit Swap(msg.sender, zeroForOne, amountIn, reserveIn * amountIn / (reserveOut + amountIn));')],
'r3-init-duplicate-only':[(INIT,'if ((reserve0 != 0 || reserve1 != 0) && reserve0 == amount0 && reserve1 == amount1) revert AlreadyInitialized();')],
'r4-approve-trader':[(OUT,'tokenOut.forceApprove(msg.sender, amountOut);\n        '+OUT)],
'r4-pay-first-trader':[state('address private recipient;'),(OUT,'if (recipient == address(0)) recipient = msg.sender;\n        tokenOut.safeTransfer(recipient, amountOut);')],
'r4-event-names-first-trader':[state('address private firstTrader;'),(EV,'if (firstTrader == address(0)) firstTrader = msg.sender;\n        emit Swap(firstTrader, zeroForOne, amountIn, amountOut);')],
'r4-owner-skips-minimum':[('amountOut == 0 || amountOut < minAmountOut','amountOut == 0 || (msg.sender != owner && amountOut < minAmountOut)')],
'r4-owner-gets-nothing':[('amountOut == 0 || amountOut < minAmountOut','(msg.sender != owner && amountOut == 0) || amountOut < minAmountOut')],
'r4-owner-event-origin':[(EV,'emit Swap(msg.sender == owner ? tx.origin : msg.sender, zeroForOne, amountIn, amountOut);')],
'r4-reverse-ignores-failed-pull':[(INTOK,'if (zeroForOne) {\n            '+INTOK+'\n        } else {\n            tokenIn.trySafeTransferFrom(msg.sender, address(this), amountIn);\n        }')],
'r4-init-ignores-failed-pull':[(T1,'token1.trySafeTransferFrom(msg.sender, address(this), amount1);')],
'r4-positive-remainder':[(INTOK,INTOK+'\n        require(tokenIn.balanceOf(msg.sender) > 0, "Insufficient balance");')],
'r4-strict-allowance':[(IMP,IMP+ERR),(INTOK,'uint256 balance = tokenIn.balanceOf(msg.sender);\n        if (balance < amountIn) revert IERC20Errors.ERC20InsufficientBalance(msg.sender, balance, amountIn);\n        uint256 allowed = tokenIn.allowance(msg.sender, address(this));\n        if (allowed <= amountIn) revert IERC20Errors.ERC20InsufficientAllowance(address(this), allowed, amountIn);\n        '+INTOK)],
'r4-strict-balance':[(IMP,IMP+ERR),(INTOK,'uint256 allowed = tokenIn.allowance(msg.sender, address(this));\n        if (allowed < amountIn) revert IERC20Errors.ERC20InsufficientAllowance(address(this), allowed, amountIn);\n        uint256 balance = tokenIn.balanceOf(msg.sender);\n        if (balance <= amountIn) revert IERC20Errors.ERC20InsufficientBalance(msg.sender, balance, amountIn);\n        '+INTOK)],
'r4-init-xor':[(AMT,'if ((amount0 == 0) != (amount1 == 0)) revert AmountNotPositive();')],
'r4-zero-needs-zero-minimum':[(ZERO,'if (amountIn == 0 && minAmountOut == 0) revert AmountNotPositive();')],
'r4-exact-balance-underpaid':[(TOK+'\n',''),(GUARD,GUARD+'\n\n        '+TOK+'\n        if (tokenIn.balanceOf(msg.sender) == amountIn) amountOut -= 1;')],
'r4-init-pulls-allowance':[(T0,'token0.safeTransferFrom(msg.sender, address(this), token0.allowance(msg.sender, address(this)));'),(T1,'token1.safeTransferFrom(msg.sender, address(this), token1.allowance(msg.sender, address(this)));')],
'r4-init-pulls-balance':[(T0,'token0.safeTransferFrom(msg.sender, address(this), token0.balanceOf(msg.sender));'),(T1,'token1.safeTransferFrom(msg.sender, address(this), token1.balanceOf(msg.sender));')],
'r4-init-books-whole-balance':[('reserve0 = amount0;','reserve0 = token0.balanceOf(msg.sender);'),('reserve1 = amount1;','reserve1 = token1.balanceOf(msg.sender);'),(T0,'token0.safeTransferFrom(msg.sender, address(this), reserve0);'),(T1,'token1.safeTransferFrom(msg.sender, address(this), reserve1);')],
'r4-unchecked-sum':[(PRICE,'uint256 grown;\n        unchecked {\n            grown = reserveIn + amountIn;\n        }\n        amountOut = reserveOut * amountIn / grown;')],
'r4-payable':[('function initialize(uint256 amount0, uint256 amount1) external {','function initialize(uint256 amount0, uint256 amount1) external payable {'),('''        external
        returns (uint256 amountOut)''','''        external
        payable
        returns (uint256 amountOut)''')],
'r4-pool-must-match-balances':[(OUT,OUT+'\n        if (token0.balanceOf(address(this)) != reserve0 || token1.balanceOf(address(this)) != reserve1) revert EmptyPool();')],
'r4-books-from-balances':[(OUT,OUT+'\n        reserve0 = token0.balanceOf(address(this));\n        reserve1 = token1.balanceOf(address(this));')],
'r4-constructor-less-or-equal':[('if (address(token0_) == address(token1_)) revert IdenticalTokens();','if (address(token0_) <= address(token1_)) revert IdenticalTokens();')],
'r4-constructor-sorts':[(CTOR,'(token0, token1) = address(token0_) > address(token1_) ? (token0_, token1_) : (token1_, token0_);')],
'r4-internal-getters':[('IERC20 public immutable token0;','IERC20 internal immutable token0;'),('IERC20 public immutable token1;','IERC20 internal immutable token1;'),('address public immutable owner;','address internal immutable owner;')],
'r4-guard-product':[(INIT,'if (reserve0 * reserve1 != 0) revert AlreadyInitialized();')],
'r4-guard-sum':[(INIT,'if (reserve0 + reserve1 != 0) revert AlreadyInitialized();')],
'r4-guard-after-transfers':[(GUARD+'\n',''),(OUT,OUT+'\n        '+GUARD)],
'r4-swap-event-in-initialize':[(T1,T1+'\n        emit Swap(msg.sender, true, amount0, amount1);')],
}
n=0
for name,pairs in M.items():
    s=src
    for a,b in pairs:
        assert s.count(a)>=1,(name,a)
        s=s.replace(a,b,1)
    assert s!=src,name
    d=f'{out}/{name}/src'; os.makedirs(d,exist_ok=True)
    open(d+'/ConstantProductPool.sol','w').write(s); n+=1
print(n,'rebuilt')
