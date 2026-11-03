# Round 4: the same, on the fixed suite

Sent on 2026-11-01 to each reviewer below, with `<reviewer>` standing for its short name (opus, sol, grok, fable, astra). Each worked in its own T3 Code thread, which holds its full report.

| Reviewer | Model | Options |
|---|---|---|
| Opus 5.5 | `claude-opus-5-5` | `{"effort": "high"}` |
| GPT-6.1 Sol | `gpt-6.1-sol` | `{"reasoningEffort": "high"}` |
| Grok 4.7 slow | `grok-4.7` | `{"reasoning_effort": "high", "fastMode": false}` |
| Fable 5.1 | `claude-fable-5-1` | `{"effort": "high"}` |
| GPT-6 Astra xhigh | `gpt-6-astra` | `{"reasoningEffort": "xhigh"}` |

## Brief

Mutation testing of a project's own test suite. Read-only in the repository. Do not start subagents.

Repository: /home/raduom/Spaces/amm-series, branch `evm-pool`, HEAD 0fd6d54, with uncommitted changes to `evm/foundry.toml` and `evm/test/` that are part of this review. Work from the working tree, not from git history. This is the owner's teaching series on automated market makers. Everything here runs locally in Foundry's test EVM, with test tokens and nothing deployed.

Background: a Haskell model is the specification: `model/src/AMM/ConstantProduct.hs`, with properties in `model/test/AMM/ConstantProductProperties.hs`. `evm/src/ConstantProductPool.sol` implements it, and `evm/test/` holds 52 Foundry tests: unit, fuzz and invariant. Name mapping: gold is `token0`, silver is `token1`, `GoldForSilver` is `zeroForOne = true`. These tests are the only evidence behind a published article until a model-versus-contract harness exists. Three earlier reviews found no contract bugs but found gaps in the tests, and those gaps have been closed: 71 known mutants are now detected. The suite was changed to do that, and no outside reader has seen the changes (`git diff` shows them).

Goal: find mutants of `src/ConstantProductPool.sol` that the suite fails to detect. Change only that file, never the tests. Look for kinds of mutant the suite has not yet been tested against; a surviving mutant is the only thing that counts, so there is no need to repeat ones that are detected.

A surviving mutant counts only if all of these hold:
- It is an ordinary programming mistake or a plausible variation of the code, not behaviour keyed to one specific amount, address or block number.
- Its behaviour differs from the model, or its accounting is off, or it breaks something the contract promises, on inputs you can name. State the input, the correct answer and the mutant's answer. Equivalent mutants and gas-only changes do not count.
- `forge test` passes under `--fuzz-seed 1` and `--fuzz-seed 2`, with the default config. Say so if it survives only because its trigger is rare under fuzzing, and estimate how rare.

Severity, so that all reviewers rate alike:
- high: a trader or the pool loses tokens, or the minimum fails to protect a trader, on ordinary inputs.
- medium: something an integrator relies on is wrong on ordinary inputs, such as the reserves, a refusal that should happen, or one-time setup.
- low: only an edge is affected, such as which error is raised, or amounts close to the limits of uint256.

Already known and recorded for later chapters, so skip these:
- using bare `transfer` or `transferFrom` instead of SafeERC20, because the test tokens never return false
- changing the order of the reserve update and the token transfers, or of the two transfers
- pricing from token balances rather than stored reserves, which shows only after a donation
- an added public function that no test calls

Also out of scope: LP shares, deposits and fees (chapter 3); `mulDiv` or narrower integer types (chapter 4); reentrancy guards and fee-on-transfer support (chapter 5); deadlines (chapter 6); a `quote` function or a `to` recipient; Sepolia deployment; the Solana program; the conformance harness.

Look closely at what is new: the `Trader` handler (the three kinds of minimum, `keepsTheProduct`, `logged`, the refusal reason and the flags) in `test/ConstantProductPool.invariant.t.sol`, `fail_on_revert` in `foundry.toml`, `afterInvariant`, the spare unit in `fund()`, and the new worked examples. Think about behaviour that depends on who trades, on how many traders there are, on the history of swaps, and on how the handler's own choices limit what it can reach.

Second, shorter task: report any test, flag or helper that cannot fail, or that passes for the wrong reason, and any test name or comment that says more than the code checks.

Rules:
- Do not edit, stage, commit or push anything in the repository.
- `forge` is at ~/.config/.foundry/bin/forge, not on PATH.
- Work in /tmp/amm-round4-<reviewer>. Copy `evm/src`, `evm/test` and `evm/foundry.toml` there from the repository's working tree, symlink `lib` to /home/raduom/Spaces/amm-series/evm/lib, and run forge from there, using a separate directory per mutant.
- Foundry saves failing invariant sequences in `cache/invariant` and replays them in later runs from the same directory, so never reuse a directory across mutants.
- Other reviewers share this machine. Run one forge at a time, with `--threads 4`.
- Never run forge or cabal with the repository as your working directory, even with `--root`. Work out the model's answers by reading it, or by hand.
- Do not delete your scratch directory. Leave it in /tmp, and avoid `rm` altogether.
- Do not end your turn with a progress note. Your last message must be the full report below.

Return a numbered list, most serious first, of at most eight distinct kinds of mutant. For each give: severity; a unified diff against `src/ConstantProductPool.sol`; the input, the correct answer and the mutant's answer; the scratch path and the exact commands you ran, with how many tests passed under each seed; and the smallest test that would detect it. Report only what you actually ran. Then list the mutants that were detected, in a few lines, so the coverage is clear. If nothing survives, say so plainly; do not pad the list.
