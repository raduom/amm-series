import os
src=open('/home/raduom/Spaces/amm-series/evm/src/ConstantProductPool.sol').read()
PRICE='amountOut = reserveOut * amountIn / (reserveIn + amountIn);'
GUARD='''if (amountOut == 0 || amountOut < minAmountOut) {
            revert OutputTooSmall();
        }'''
EMPTY='if (reserve0 == 0 || reserve1 == 0) revert EmptyPool();'
ZERO='if (amountIn == 0) revert AmountNotPositive();'
OWNER='if (msg.sender != owner) revert NotOwner();'
INIT='if (reserve0 != 0 || reserve1 != 0) revert AlreadyInitialized();'
RES='zeroForOne ? (reserve0, reserve1) : (reserve1, reserve0);'
INTOK='tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);'
OUT='tokenOut.safeTransfer(msg.sender, amountOut);'
TOK='''(IERC20 tokenIn, IERC20 tokenOut) =
            zeroForOne ? (token0, token1) : (token1, token0);'''
ERRIMP='import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";\n'
IMP='import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";\n'
T0='token0.safeTransferFrom(msg.sender, address(this), amount0);'
T1='token1.safeTransferFrom(msg.sender, address(this), amount1);'
THIS='address(this)'
M={
 'high-unlimited-approval-skips-payment':[(INTOK,'if (tokenIn.allowance(msg.sender, address(this)) != type(uint256).max) {\n            '+INTOK+'\n        }')],
 'high-sorted-settlement-tokens':[(TOK,'(IERC20 first, IERC20 second) = address(token0) > address(token1) ? (token0, token1) : (token1, token0);\n        (IERC20 tokenIn, IERC20 tokenOut) = zeroForOne ? (first, second) : (second, first);')],
 'high-direction-flips-with-address-order':[(ZERO,'if (address(token0) < address(token1)) zeroForOne = !zeroForOne;\n\n        '+ZERO)],
 'reverse-books-from-balance':[('reserve0 = reserveOut - amountOut;','reserve0 = token0.balanceOf(address(this)) - amountOut;')],
 'reverse-prices-from-both-balances':[(RES,'zeroForOne ? (reserve0, reserve1) : (token1.balanceOf(address(this)), token0.balanceOf(address(this)));')],
 'reverse-prices-out-from-balance':[(RES,'zeroForOne ? (reserve0, reserve1) : (reserve1, token0.balanceOf(address(this)));')],
 'reverse-prices-in-from-balance':[(RES,'zeroForOne ? (reserve0, reserve1) : (token1.balanceOf(address(this)), reserve0);')],
 'origin-can-act-as-owner':[(OWNER,'if (msg.sender != owner && tx.origin != owner) revert NotOwner();')],
 'contracts-bypass-owner':[(OWNER,'if (msg.sender != owner && msg.sender.code.length == 0) revert NotOwner();')],
 'nonowner-contract-refused':[(ZERO,'if (msg.sender != owner && msg.sender.code.length != 0) revert NotOwner();\n        '+ZERO)],
 'allowance-must-decrease':[(INTOK,'uint256 approved = tokenIn.allowance(msg.sender, address(this));\n        '+INTOK+'\n        assert(tokenIn.allowance(msg.sender, address(this)) == approved - amountIn);')],
 'symbol-as-token-identity':[(IMP,IMP+'import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";\n'),('if (address(token0_) == address(token1_)) revert IdenticalTokens();','if (keccak256(bytes(IERC20Metadata(address(token0_)).symbol())) == keccak256(bytes(IERC20Metadata(address(token1_)).symbol()))) {\n            revert IdenticalTokens();\n        }')],
 'init-sorted-tokens':[(T0,'(IERC20 high, IERC20 low) = address(token0) > address(token1) ? (token0, token1) : (token1, token0);\n        high.safeTransferFrom(msg.sender, address(this), amount0);'),(T1,'low.safeTransferFrom(msg.sender, address(this), amount1);')],
 'init-guard-silver-balance':[(INIT,'if (token1.balanceOf(address(this)) != 0) revert AlreadyInitialized();')],
 'init-guard-both-balances':[(INIT,INIT+'\n        if (token0.balanceOf(address(this)) != 0 && token1.balanceOf(address(this)) != 0) revert AlreadyInitialized();')],
 'init-books-silver-from-balance':[('reserve1 = amount1;','reserve1 = token1.balanceOf(address(this)) + amount1;')],
 'init-tops-up-gold':[(T0,'token0.safeTransferFrom(msg.sender, address(this), amount0 - token0.balanceOf(address(this)));')],
 'init-pulls-only-shortfall':[('reserve0 = amount0;\n','uint256 prior0 = token0.balanceOf(address(this));\n        uint256 prior1 = token1.balanceOf(address(this));\n\n        reserve0 = amount0;\n'),(T0,'token0.safeTransferFrom(msg.sender, address(this), prior0 >= amount0 ? 0 : amount0 - prior0);'),(T1,'token1.safeTransferFrom(msg.sender, address(this), prior1 >= amount1 ? 0 : amount1 - prior1);')],
 'low-funds-before-minimum-reverse':[(IMP,IMP+ERRIMP),(GUARD,'if (!zeroForOne) {\n            uint256 allowed = token1.allowance(msg.sender, address(this));\n            if (allowed < amountIn) revert IERC20Errors.ERC20InsufficientAllowance(address(this), allowed, amountIn);\n            uint256 bal = token1.balanceOf(msg.sender);\n            if (bal < amountIn) revert IERC20Errors.ERC20InsufficientBalance(msg.sender, bal, amountIn);\n        }\n        '+GUARD)],
 'low-reverse-unchecked-product':[(PRICE,'if (zeroForOne) {\n            '+PRICE+'\n        } else {\n            uint256 numerator;\n            unchecked { numerator = reserveOut * amountIn; }\n            amountOut = numerator / (reserveIn + amountIn);\n        }')],
 'low-empty-judged-by-balance':[(EMPTY,'if (token0.balanceOf(address(this)) == 0 || token1.balanceOf(address(this)) == 0) revert EmptyPool();')],
 'low-minimum-before-empty':[(EMPTY+'\n',''),(GUARD,'if (amountOut < minAmountOut) revert OutputTooSmall();\n        '+EMPTY+'\n        if (amountOut == 0) revert OutputTooSmall();')],
 'low-zero-output-after-transfers':[(GUARD,'if (amountOut < minAmountOut) revert OutputTooSmall();'),(OUT,OUT+'\n        if (amountOut == 0) revert OutputTooSmall();')],
 'low-empty-and-zero-after-transfers':[(EMPTY+'\n',''),(GUARD,'if (amountOut < minAmountOut) revert OutputTooSmall();'),(OUT,OUT+'\n        '+EMPTY+'\n        if (amountOut == 0) revert OutputTooSmall();')],
 'low-reverse-divides-product':[(PRICE,'amountOut = zeroForOne\n            ? reserveOut * amountIn / (reserveIn + amountIn)\n            : reserveOut - (reserveIn * reserveOut + reserveIn + amountIn - 1) / (reserveIn + amountIn);')],
 'low-signed-silver-reserve':[(EMPTY,'if (reserve0 == 0 || int256(reserve1) <= 0) revert EmptyPool();')],
 'low-payable-constructor':[('constructor(IERC20 token0_, IERC20 token1_) {','constructor(IERC20 token0_, IERC20 token1_) payable {')],
}
lines=[]
for n,pairs in M.items():
    s=src
    for a,b in pairs:
        assert s.count(a)==1,(n,a,s.count(a))
        s=s.replace(a,b)
    assert s!=src
    d=f'/tmp/amm-round5-verify/bugs/{n}/src'
    os.makedirs(d,exist_ok=True)
    open(d+'/ConstantProductPool.sol','w').write(s)
    lines.append(f'{n} /tmp/amm-round5-verify/bugs/{n}')
open('list.txt','w').write('base /home/raduom/Spaces/amm-series/evm\n'+'\n'.join(lines)+'\n')
print(len(lines),'rebuilt')
