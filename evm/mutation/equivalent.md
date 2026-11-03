# Equivalent mutants

These are the tool mutants that compile to new bytecode but change nothing a caller can see, so no test can catch them. All 35 pass the suite before and after closing the gaps, and each one was judged by hand. The reason for each is below; a second check is still to do.

Each name is the mutant's diff in [bugs/tools](bugs/tools), and the tools that made it come from [bugs/tools.json](bugs/tools.json).

## A `uint256` is never below zero

So `x <= 0` is `x == 0`, `x > 0` is `x != 0`, and `x < 0` is always false.

| Mutant | Tools | Change |
|---|---|---|
| [`05b088b1a7e8`](bugs/tools/05b088b1a7e8.diff) | forge, umut | `reserve0 <= 0` in the empty-pool check |
| [`a4f3b8297fad`](bugs/tools/a4f3b8297fad.diff) | forge, umut | `reserve1 <= 0` in the empty-pool check |
| [`2252ac9f50d2`](bugs/tools/2252ac9f50d2.diff) | forge, umut | `amountOut <= 0` in the output check |
| [`072a7d4b7fdd`](bugs/tools/072a7d4b7fdd.diff) | slither | `amountOut <= 0` in the output check, with the minimum compared twice |
| [`7efe179d87ad`](bugs/tools/7efe179d87ad.diff) | forge, slither, umut | `amountIn <= 0` in the swap's zero check |
| [`9433a913b8af`](bugs/tools/9433a913b8af.diff) | forge, umut | `amount0 <= 0` in `initialize`'s zero check |
| [`64f309202d7a`](bugs/tools/64f309202d7a.diff) | forge, umut | `amount1 <= 0` in `initialize`'s zero check |
| [`30c5768b715c`](bugs/tools/30c5768b715c.diff) | forge, umut | `reserve1 > 0` in the already-initialized check |
| [`dc9b2f98f2ba`](bugs/tools/dc9b2f98f2ba.diff) | forge, umut | `reserve0 > 0` in the already-initialized check |

## The reserves are only ever zero together

Before `initialize` both are zero. `initialize` refuses a zero amount, and a swap keeps both positive, since it adds a positive `amountIn` to one and pays out less than all of the other. So a check on one reserve, or on both joined with `&&` instead of `||`, decides the same way.

| Mutant | Tools | Change |
|---|---|---|
| [`5c1bb7666aba`](bugs/tools/5c1bb7666aba.diff) | forge, slither, sumo, umut | the empty-pool check joined with `&&` |
| [`058dbec6ca66`](bugs/tools/058dbec6ca66.diff) | umut | the empty-pool check tests `reserve0` twice |
| [`2754ad3e73fe`](bugs/tools/2754ad3e73fe.diff) | umut | the empty-pool check tests `reserve1` twice |
| [`36cb3939f4af`](bugs/tools/36cb3939f4af.diff) | umut | the empty-pool check's `reserve0` test replaced by `(0==1)` |
| [`63e1310e223f`](bugs/tools/63e1310e223f.diff) | forge, umut | the empty-pool check's `reserve1` test is `reserve1 < 0`, always false |
| [`a606280e6f1b`](bugs/tools/a606280e6f1b.diff) | forge, umut | the empty-pool check's `reserve0` test is `reserve0 < 0`, always false |
| [`bc39ea8d8896`](bugs/tools/bc39ea8d8896.diff) | forge, slither, sumo, umut | the already-initialized check joined with `&&` |
| [`3b89b2432bed`](bugs/tools/3b89b2432bed.diff) | umut | the already-initialized check tests `reserve0` twice |
| [`71c14916f3e9`](bugs/tools/71c14916f3e9.diff) | umut | the already-initialized check tests `reserve1` twice |
| [`e679e7ba8a4a`](bugs/tools/e679e7ba8a4a.diff) | umut | the already-initialized check's `reserve0` test replaced by `(0==1)` |
| [`56cfed7cd45a`](bugs/tools/56cfed7cd45a.diff) | forge, umut | the already-initialized check's `reserve1` test is `reserve1 < 0`, always false |
| [`e26dac5efdcb`](bugs/tools/e26dac5efdcb.diff) | forge, umut | the already-initialized check's `reserve0` test is `reserve0 < 0`, always false |

## Two lines that can run in either order

Neither line reads what the other writes, and no other contract runs between them, so nothing can see the order. Where the moved line now runs before a check, the check's revert undoes it.

| Mutant | Tools | Change |
|---|---|---|
| [`1470977ca611`](bugs/tools/1470977ca611.diff) | umut | `initialize` books `reserve1` before `reserve0` |
| [`2c29f6dabe44`](bugs/tools/2c29f6dabe44.diff) | umut | a swap from token0 books `reserve1` before `reserve0` |
| [`e59e68f45433`](bugs/tools/e59e68f45433.diff) | umut | a swap from token1 books `reserve1` before `reserve0` |
| [`d3d41755dfe2`](bugs/tools/d3d41755dfe2.diff) | umut | `reserve0 = reserveIn + amountIn` moves above the `if`; a swap from token1 then overwrites it in the `else` branch |
| [`587edcd7f5b9`](bugs/tools/587edcd7f5b9.diff) | umut | `initialize` books `reserve0` before checking the amounts, which revert if either is zero |
| [`9a6aabbc2c64`](bugs/tools/9a6aabbc2c64.diff) | umut | the constructor sets `token0` before the identical-token check, which reverts the whole deployment |
| [`ee2584a96ff8`](bugs/tools/ee2584a96ff8.diff) | umut | the constructor sets `token1` before `token0` |
| [`b24b404d6f70`](bugs/tools/b24b404d6f70.diff) | umut | the constructor sets `owner` before `token1` |

## Declarations in another order, or not immutable

The getters, their selectors and every value they return stay the same. An immutable lives in the code and a plain variable in storage, which changes the gas and the bytecode, but nothing writes these after the constructor and nothing outside reads storage slots by number.

| Mutant | Tools | Change |
|---|---|---|
| [`d2e8cdccc003`](bugs/tools/d2e8cdccc003.diff) | umut | `token1` declared before `token0` |
| [`7c1e11e8c3a7`](bugs/tools/7c1e11e8c3a7.diff) | umut | `owner` declared before `token1` |
| [`c61fd2053953`](bugs/tools/c61fd2053953.diff) | umut | `reserve1` declared before `reserve0`, which swaps their storage slots |
| [`e374a0244635`](bugs/tools/e374a0244635.diff) | umut | `token0` not immutable |
| [`a82166f12bd0`](bugs/tools/a82166f12bd0.diff) | umut | `token1` not immutable |
| [`f14b71d08785`](bugs/tools/f14b71d08785.diff) | umut | `owner` not immutable |

## Not equivalent

The other four survivors of the suite the tools were compared against are real gaps:

- [`a818800c97e9`](bugs/tools/a818800c97e9.diff): `msg.sender < owner` lets any address above the owner initialize the pool. Caught now by `test_InitializeIsOnlyForTheOwner`.
- [`80381c469cb5`](bugs/tools/80381c469cb5.diff): `initialize` pulls silver before gold, so with neither token approved the refusal names silver instead of gold. Caught now by `test_InitializeTakesGoldFirst`.
- [`4b45eb1f64bb`](bugs/tools/4b45eb1f64bb.diff): a swap pays out before it pulls the input in.
- [`046d10193e76`](bugs/tools/046d10193e76.diff): `initialize` pulls gold before booking `reserve1`.

The last two only show with a token that calls back into the pool during a transfer, which chapter 5 brings in.
