# Round 1: each reviewer checks the others' findings

Sent on 2026-10-31 to each reviewer below, with `<reviewer>` standing for its short name (opus, sol, grok, fable, astra). Each worked in its own T3 Code thread, which holds its full report.

| Reviewer | Model | Options |
|---|---|---|
| Opus 5.5 | `claude-opus-5-5` | `{"effort": "high"}` |
| GPT-6.1 Sol | `gpt-6.1-sol` | `{"reasoningEffort": "high"}` |
| Grok 4.7 slow | `grok-4.7` | `{"reasoning_effort": "high", "fastMode": false}` |
| Fable 5.1 | `claude-fable-5-1` | `{"effort": "high"}` |
| GPT-6 Astra xhigh | `gpt-6-astra` | `{"reasoningEffort": "xhigh"}` |

## Brief

Cross-check round of a code review, read-only. Do not start subagents. Treat the nine claims below as unverified: some may be wrong, overstated or understated. Try to refute each one, and judge it on the code and on what you can run.

Repository: /home/raduom/Spaces/amm-series, branch `evm-pool` (checked out, HEAD 063dc51), compared with `main`. It is a teaching series: the Haskell model `model/src/AMM/ConstantProduct.hs` is the specification and `evm/src/ConstantProductPool.sol` implements it. Tests are in `evm/test/`; the ported properties are in `model/test/AMM/ConstantProductProperties.hs`. The chapter 2 pool has one owner who supplies all liquidity. The roadmap publishes the Ethereum article before any model-versus-contract conformance harness exists, so Foundry tests are the only evidence behind that article.

Claims:

F1. `evm/src/ConstantProductPool.sol:46`: the constructor accepts `token0_ == token1_`. With one token T, `initialize(100, 10000)` then `swap(true, 100, 0)` pays 5000 for 100, so a trader extracts the owner's funds. Proposed fix: reject identical tokens in the constructor. Counter-view: this hurts only the deployer's own funds, so it may not merit a check in a teaching contract.

F2. `evm/test/ConstantProductPool.t.sol:74-78`, and `evm/test/ConstantProductPool.invariant.t.sol:37`: `tradeOrDiscard` discards on any revert and the invariant handler ignores any revert, so a contract that wrongly refuses swaps the model accepts can pass. Example mutants said to survive all 30 tests: reject when `uint96.max < reserveIn <= uint112.max`; `if (amountIn * 1000 < reserveIn) revert OutputTooSmall();`. Proposed fix: discard only when the output by the formula is really zero, and fail on anything else. Checking only for the `OutputTooSmall` selector is said not to be enough, because the second mutant uses that error.

F3. `README.md:45-50`: the Running block leaves the shell in `evm/` after `cd evm && forge test`, so the next `cd web` fails when the block is run top to bottom. Proposed fix: `(cd evm && forge test)` or `forge test --root evm`.

F4. `evm/test/ConstantProductPool.t.sol:253`: the comment says a refused way back "is no profit either", but the code discards the case, while the model's `prop_roundTripNeverProfits` counts a refusal as a pass. About 2.5% of runs are discarded here. Proposed fix: treat a refused return as `back = 0` or return early.

F5. `evm/src/ConstantProductPool.sol:11`: the contract doc says `reserve0 * reserve1` "stays the same", but rounding makes it grow: (1000, 1000) with input 100 gives (1100, 910), so the product goes from 1,000,000 to 1,001,000. Proposed fix: say the product never decreases. Note that the model's module comment uses similar wording.

F6. `evm/test/ConstantProductPool.t.sol:194`: the test comment "Stronger than the model's property" overclaims. The test checks minimums of zero, the output, and the output plus one. Replacing the contract's comparison with `amountOut + 1 == minAmountOut` is said to survive all 30 tests, while accepting input 100 with minimum 1000 and paying 90. Proposed fix: also fuzz minimums below and above the output.

F7. `evm/test/ConstantProductPool.t.sol:101`: the suite does not pin the pricing formula. Every worked example has a non-integer quotient and no fuzz test compares `amountOut` with the formula. Mutants said to survive all 30 tests: denominator `reserveIn + amountIn + 1`; a hidden 0.1% fee, `reserveOut * amountIn * 999 / (reserveIn * 1000 + amountIn * 999)`. Proposed fix: add an example with an exact quotient, such as `stock(100, 100); assertEq(trade(true, 100, 0), 50);`, or a fuzz `assertEq` against the formula.

F8. `evm/test/ConstantProductPool.t.sol:318`: `test_SwapEmitsAnEvent` only covers `zeroForOne = true`, so hard-coding `true` in the event survives all tests. Proposed fix: add the mirror test.

F9. `evm/src/ConstantProductPool.sol:35`: the NatSpec on `AmountNotPositive` says "`amountIn` is zero", but `initialize` also raises it for `amount0` or `amount1`. Proposed fix: reword to "An amount is zero".

Rules: do not edit, stage, commit or push anything in the repository. `forge` is at ~/.config/.foundry/bin/forge (not on PATH). To experiment, copy `evm/src`, `evm/test` and `evm/foundry.toml` to a fresh `mktemp -d` directory, symlink `lib` to /home/raduom/Spaces/amm-series/evm/lib, `cd` into that temporary directory, and run `forge test` there. Do not run forge from inside the repository, because failure caches are written relative to the working directory. Other reviewers are using this checkout. Reproduce the mutant claims; do not take them on trust.

Return one entry per claim: F-number; verdict CONFIRMED, PARTLY or REJECTED; your severity (high/medium/low/none); whether you reproduced it and how; whether the proposed fix is right; and one or two sentences of reasoning. Say so if a proposed fix is wrong or insufficient. Report a new defect only if you noticed one while checking, in a separate short list.
