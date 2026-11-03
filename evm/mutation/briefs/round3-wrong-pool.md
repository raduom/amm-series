# Round 3: write a pool that passes

Sent on 2026-11-01 to each reviewer below, with `<reviewer>` standing for its short name (opus, sol, grok, fable, astra). Each worked in its own T3 Code thread, which holds its full report.

| Reviewer | Model | Options |
|---|---|---|
| Opus 5.5 | `claude-opus-5-5` | `{"effort": "high"}` |
| GPT-6.1 Sol | `gpt-6.1-sol` | `{"reasoningEffort": "high"}` |
| Grok 4.7 slow | `grok-4.7` | `{"reasoning_effort": "high", "fastMode": false}` |
| Fable 5.1 | `claude-fable-5-1` | `{"effort": "high"}` |
| GPT-6 Astra xhigh | `gpt-6-astra` | `{"reasoningEffort": "xhigh"}` |

## Brief

Adversarial test-suite review, read-only. Do not start subagents.

Repository: /home/raduom/Spaces/amm-series, branch `evm-pool`, commit 0fd6d54.

Context: a teaching series that builds AMMs. A Haskell model is the specification: `model/src/AMM/ConstantProduct.hs`, with properties in `model/test/AMM/ConstantProductProperties.hs`. `evm/src/ConstantProductPool.sol` implements it, and `evm/test/` holds 42 Foundry tests: unit, fuzz and invariant. Name mapping: gold is `token0`, silver is `token1`, `GoldForSilver` is `zeroForOne = true`. These tests are the only evidence behind a published article until a model-versus-contract conformance harness exists. Two earlier reviews found no contract bugs but found real gaps in the tests, so assume the contract is right and attack the tests.

Your task: write wrong pools that pass all 42 tests. Change only `src/ConstantProductPool.sol`, never the tests.

A surviving bug counts only if all of these hold:
- It is a mistake a programmer could plausibly make, or a plausible variation of the code. Do not key behaviour to one magic amount, address or block number, because no fixed suite could guess those.
- It differs observably from the model, or it misaccounts or loses tokens, on inputs you can name. State the input, the model's answer and the wrong pool's answer. Equivalent mutants and gas-only changes do not count.
- `forge test` passes under `--fuzz-seed 1` and `--fuzz-seed 2`, with the default config. Say so if it survives only because its trigger is rare under fuzzing, and estimate how rare.

These are already known and recorded for later chapters, so do not report them:
- unchecked token call results, such as replacing SafeERC20 with bare `transfer` or `transferFrom`, because the test tokens never return false
- changing the order of the reserve update and the token transfers
- pricing from token balances rather than stored reserves, which shows only after a donation
- an added public function that no test calls, such as `sweep()`

Also out of scope: LP shares, deposits and fees (chapter 3); `mulDiv` or narrower integer types (chapter 4); reentrancy guards and fee-on-transfer support (chapter 5); deadlines (chapter 6); a `quote` function or a `to` recipient; Sepolia deployment; the Solana program; the conformance harness.

Think about kinds of bug, not variations of one. The last review's biggest gaps were bugs that appear only after the first swap, and pools whose return value disagrees with what actually moved. Fixes for those were added, and no outside reviewer has read them. Attack them specifically: the `Trader` handler and its flags in `test/ConstantProductPool.invariant.t.sol`, `checkOutput`, the `trade()` and `tradeOrDiscard()` helpers in `test/ConstantProductPool.t.sol`, and the two pool sizes in the invariant runs. Consider state carried between swaps, one direction versus the other, amounts straddling the ranges the tests use, boundaries of the minimum check, the refusal conditions, `initialize`, and the events.

Second, shorter task: report any test, flag or helper that cannot fail, or that passes for the wrong reason, and any test name or comment that says more than the code checks.

Rules:
- Do not edit, stage, commit or push anything in the repository.
- `forge` is at ~/.config/.foundry/bin/forge, not on PATH.
- Work in /tmp/amm-hunt-<reviewer>. Copy `evm/src`, `evm/test` and `evm/foundry.toml` there from the repository, symlink `lib` to /home/raduom/Spaces/amm-series/evm/lib, `cd` there and run `forge test` there. Make a subdirectory per mutant if you like.
- Never run forge or cabal with the repository as your working directory, even with `--root`, because caches are written relative to it. Work out the model's answers by reading it, or by hand.
- Do not delete your scratch directory. Leave it in /tmp, and avoid `rm` altogether.

Return a numbered list, strongest first, of at most eight distinct kinds of bug. For each give: severity (high/medium/low); a unified diff against `src/ConstantProductPool.sol`; the input, the model's answer and the wrong pool's answer; the scratch path and the exact commands you ran, with how many tests passed under each seed; and the smallest test that would catch it. Report only what you actually ran. Then list what you tried that was caught, in a few lines, so the coverage of your attempt is clear. If nothing survives, say so plainly; do not pad the list.
