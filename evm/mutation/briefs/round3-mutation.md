# Round 3: mutation testing

Sent on 2026-11-01 to each reviewer below, with `<reviewer>` standing for its short name (opus, sol, grok, fable, astra). Each worked in its own T3 Code thread, which holds its full report.

| Reviewer | Model | Options |
|---|---|---|
| GPT-6.1 Sol | `gpt-6.1-sol` | `{"reasoningEffort": "high"}` |
| GPT-6 Astra xhigh | `gpt-6-astra` | `{"reasoningEffort": "xhigh"}` |

## Brief

Mutation testing of a project's own test suite. Read-only in the repository. Do not start subagents.

Repository: /home/raduom/Spaces/amm-series, branch `evm-pool`, commit 0fd6d54. This is the owner's teaching series on automated market makers. Everything here runs locally in Foundry's test EVM, with test tokens and nothing deployed.

Background: a Haskell model is the specification: `model/src/AMM/ConstantProduct.hs`, with properties in `model/test/AMM/ConstantProductProperties.hs`. `evm/src/ConstantProductPool.sol` implements it, and `evm/test/` holds 42 Foundry tests: unit, fuzz and invariant. Name mapping: gold is `token0`, silver is `token1`, `GoldForSilver` is `zeroForOne = true`. Two earlier reviews found the contract correct but the test suite incomplete, so the question is how good the tests are.

Goal: find mutants of `src/ConstantProductPool.sol` that the suite fails to detect, so the tests can be improved. Change only that file, never the tests.

A surviving mutant counts only if all of these hold:
- It is an ordinary programming mistake or a plausible variation of the code, not behaviour keyed to one specific amount, address or block number.
- Its behaviour differs from the model, or its accounting is off, on inputs you can name. State the input, the model's answer and the mutant's answer. Equivalent mutants and gas-only changes do not count.
- `forge test` passes under `--fuzz-seed 1` and `--fuzz-seed 2`, with the default config. Say so if it survives only because its trigger is rare under fuzzing, and estimate how rare.

Already known and recorded for later chapters, so skip these:
- using bare `transfer` or `transferFrom` instead of SafeERC20, because the test tokens never return false
- changing the order of the reserve update and the token transfers
- pricing from token balances rather than stored reserves, which shows only after a donation
- an added public function that no test calls

Also out of scope: LP shares, deposits and fees (chapter 3); `mulDiv` or narrower integer types (chapter 4); reentrancy guards and fee-on-transfer support (chapter 5); deadlines (chapter 6); a `quote` function or a `to` recipient; Sepolia deployment; the Solana program; the conformance harness.

Aim for different kinds of mutant rather than variations of one. The last review's biggest gaps were mutants that show only after the first swap, and mutants whose return value disagrees with what moved. Tests for those were added recently and have had no outside reading, so look closely at the `Trader` handler and its flags in `test/ConstantProductPool.invariant.t.sol`, `checkOutput`, the `trade()` and `tradeOrDiscard()` helpers in `test/ConstantProductPool.t.sol`, and the two pool sizes in the invariant runs. Consider state kept between swaps, one direction versus the other, amounts around the ranges the tests use, boundaries of the minimum check, the refusal conditions, `initialize`, and the events.

Second, shorter task: report any test, flag or helper that cannot fail, or that passes for the wrong reason, and any test name or comment that says more than the code checks.

Rules:
- Do not edit, stage, commit or push anything in the repository.
- `forge` is at ~/.config/.foundry/bin/forge, not on PATH.
- Work in /tmp/amm-mutants-<reviewer>. Copy `evm/src`, `evm/test` and `evm/foundry.toml` there from the repository, symlink `lib` to /home/raduom/Spaces/amm-series/evm/lib, `cd` there and run `forge test` there. Make a subdirectory per mutant if you like.
- Never run forge or cabal with the repository as your working directory, even with `--root`, because caches are written relative to it. Work out the model's answers by reading it, or by hand.
- Do not delete your scratch directory. Leave it in /tmp, and avoid `rm` altogether.

Return a numbered list, most serious first, of at most eight distinct kinds of mutant. For each give: severity (high/medium/low); a unified diff against `src/ConstantProductPool.sol`; the input, the model's answer and the mutant's answer; the scratch path and the exact commands you ran, with how many tests passed under each seed; and the smallest test that would detect it. Report only what you actually ran. Then list the mutants that were detected, in a few lines, so the coverage is clear. If nothing survives, say so plainly; do not pad the list.
