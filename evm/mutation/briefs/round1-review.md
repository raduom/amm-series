# Round 1: general review

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

Repository: /home/raduom/Spaces/amm-series. Review the four commits on local branch `evm-pool` against `main`: `git diff main..evm-pool` and `git log main..evm-pool`. That branch is currently checked out.

Context: a teaching series that builds AMMs. A Haskell model is the specification, and contracts implement it. This branch adds a Foundry project: `evm/src/ConstantProductPool.sol` implements `model/src/AMM/ConstantProduct.hs`, with tests in `evm/test/`. `model/test/AMM/ConstantProductProperties.hs` holds the properties the fuzz tests port. Read AGENTS.md and ROADMAP.md for project rules and scope. README.md, ROADMAP.md, .gitignore, .gitmodules, evm/foundry.toml and evm/foundry.lock also changed; review those too.

Look for: behaviour differing from the Haskell model; contract bugs and security problems within this chapter's scope; tests that are vacuous, wrong, or claim more than they check; fuzz tests whose discards or bounds weaken them; test names or comments that misdescribe the code; config, pinning or submodule mistakes; README and ROADMAP statements that are false or do not match the repo.

Deliberately out of scope, so do not report their absence: LP shares, deposits and fees (chapter 3); `mulDiv` or narrower integer types (chapter 4); reentrancy guards and fee-on-transfer support (chapter 5); deadlines (chapter 6); a `quote` function or a `to` recipient; Sepolia deployment; the Solana program; the conformance harness; the licence. Style preferences with no real consequence are also out of scope.

Rules: do not edit, stage, commit, or push anything in the repository. `forge` is at ~/.config/.foundry/bin/forge (not on PATH). To run or experiment, copy to a fresh `mktemp -d` directory with `lib` symlinked to /home/raduom/Spaces/amm-series/evm/lib and run with `forge test --root <dir>`, because other reviewers use this checkout at the same time. Verify every finding against the code; run it where you can.

Return a numbered list. For each finding give: severity (high/medium/low), file:line, one sentence stating the defect, a concrete scenario showing it, how you verified it, and a suggested fix. Say which findings you actually reproduced. If you find nothing in an area, say so; do not pad the list.
