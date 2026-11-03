# Round 2: general review

Sent on 2026-10-31 to each reviewer below, with `<reviewer>` standing for its short name (opus, sol, grok, fable, astra). Each worked in its own T3 Code thread, which holds its full report.

| Reviewer | Model | Options |
|---|---|---|
| Opus 5.5 | `claude-opus-5-5` | `{"effort": "high"}` |
| GPT-6.1 Sol | `gpt-6.1-sol` | `{"reasoningEffort": "high"}` |
| Grok 4.7 slow | `grok-4.7` | `{"reasoning_effort": "high", "fastMode": false}` |
| Fable 5.1 | `claude-fable-5-1` | `{"effort": "high"}` |
| GPT-6 Astra xhigh | `gpt-6-astra` | `{"reasoningEffort": "xhigh"}` |

## Brief

Independent code review, read-only. Do not start subagents.

Repository: /home/raduom/Spaces/amm-series, branch `evm-pool`, checked out, HEAD 063dc51. The working tree has uncommitted changes that are part of this review. Review the whole branch as it stands in the working tree: `git diff main` shows everything, and `git diff HEAD` shows the uncommitted part. Give the uncommitted part particular attention, but do not limit yourself to it.

Context: a teaching series that builds AMMs. A Haskell model is the specification, and contracts implement it. This branch adds a Foundry project: `evm/src/ConstantProductPool.sol` implements `model/src/AMM/ConstantProduct.hs`, with tests in `evm/test/`. `model/test/AMM/ConstantProductProperties.hs` holds the properties the fuzz tests port. Read AGENTS.md and ROADMAP.md for project rules and scope. The roadmap publishes the Ethereum article before any model-versus-contract conformance harness exists, so the Foundry tests are the only evidence behind that article. README.md, ROADMAP.md, .gitignore, .gitmodules, evm/foundry.toml and evm/foundry.lock also changed; review those too.

Look for: behaviour differing from the Haskell model; contract bugs and security problems within this chapter's scope; tests that are vacuous, wrong, or claim more than they check; test helpers with mistakes of their own, including anything that could make a test pass for the wrong reason or discard cases it should judge; what kinds of contract bug the suite still cannot detect; test names or comments that misdescribe the code; config, pinning or submodule mistakes; README and ROADMAP statements that are false or do not match the repo. Check that comment changes did not break the web build's source line checks.

Deliberately out of scope, so do not report their absence: LP shares, deposits and fees (chapter 3); `mulDiv` or narrower integer types (chapter 4); reentrancy guards and fee-on-transfer support (chapter 5); deadlines (chapter 6); a `quote` function or a `to` recipient; Sepolia deployment; the Solana program; the conformance harness; the licence. Style preferences with no real consequence are also out of scope. One deliberate choice to judge on its merits rather than assume: in `testFuzz_RoundTripNeverProfits`, a return leg that pays nothing is discarded rather than counted as a pass.

Rules: do not edit, stage, commit, or push anything in the repository. `forge` is at ~/.config/.foundry/bin/forge (not on PATH). To experiment, copy `evm/src`, `evm/test` and `evm/foundry.toml` from the working tree to a fresh `mktemp -d` directory, symlink `lib` to /home/raduom/Spaces/amm-series/evm/lib, `cd` into that temporary directory, and run `forge test` there. Never run forge with the repository as your working directory, even with `--root`, because failure caches are written relative to the working directory. Other reviewers use this checkout at the same time. Verify every finding against the code; run it where you can, and try writing mutants that pass the suite.

Return a numbered list. For each finding give: severity (high/medium/low), file:line, one sentence stating the defect, a concrete scenario showing it, how you verified it, and a suggested fix. Say which findings you actually reproduced. If you find nothing in an area, say so; do not pad the list.
