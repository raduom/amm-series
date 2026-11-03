# Second check of the equivalent mutants

Sent on 2026-11-03 to one reviewer, which worked in its own T3 Code thread. It got the contract and 39 tool mutants in `/tmp/amm-equiv-review/`: the 35 then judged equivalent and the four real gaps beside them, shuffled and renamed `m01` to `m39`. [reviewers/equivalent-check/key.txt](../reviewers/equivalent-check/key.txt) gives each one's real name.

| Reviewer | Model | Options |
|---|---|---|
| GPT-6.1 Sol | `gpt-6.1-sol` | `{"reasoningEffort": "high"}` |

## Brief

This is mutation testing work on a teaching project's Solidity contract. I need an independent judgment of which mutants are equivalent.

**Material.** Everything is in `/tmp/amm-equiv-review/`:
- `ConstantProductPool.sol` is the contract, a small constant-product pool with an owner, `initialize` and `swap`.
- `mutants/m01.diff` to `mutants/m39.diff` are 39 mutants of it, as unified diffs. Each one compiles to different bytecode from the original.
- The OpenZeppelin sources it imports are under `/home/raduom/Spaces/amm-series/evm/lib/openzeppelin-contracts/contracts/` if you need them.

**The question.** For each mutant, decide whether it is equivalent: does it change nothing that any caller or contract on chain can observe? That covers return values, reverts and revert reasons, events and logs, token balances, the values getters return, and what happens when a token contract calls back into the pool during a transfer. Gas use and bytecode don't count. Some of the 39 may well be equivalent and some may not; I'm not telling you how many of each. Judge each one on its own.

**What to write**, in `/tmp/amm-equiv-review/verdicts.md`, as a table with one row per mutant:
- the mutant's name, such as `m07`;
- the change in a few words;
- `equivalent` or `not equivalent`;
- the reason. For `equivalent`, the argument that no caller can tell the difference, for example a fact about the state that always holds. For `not equivalent`, a concrete sequence of calls that behaves differently, with the inputs, and what each version does. Say so if that sequence needs a token that calls back into the pool.

After the table, list any mutant you were unsure about and what made it hard.

**Rules:**
- Don't edit anything under `/home/raduom/Spaces/amm-series`. Write only inside `/tmp/amm-equiv-review/`.
- Don't read any of `/home/raduom/Spaces/amm-series/evm/mutation/` or the repository's git history. They hold an earlier judgment of these mutants, and this check must not be anchored on it.
- Don't run `forge` or any other build or test tool. The machine is already running two forge jobs, and its power supply can't take more. Reason from the code. Where a claim needs checking, give the call sequence so it can be run later.
- Reply with a short summary: how many you judged equivalent, how many not, and which ones were unsure.

## Its question, and the answer

**Question:** Should equivalence include executing the pool's code via DELEGATECALL in another contract's storage? That changes the verdicts for storage layout and reserve-invariant mutants. I'll otherwise use the literal "any contract on chain" scope, which includes DELEGATECALL and STATICCALL.

**Answer:** Pool's own storage only; include STATICCALL. The pool is deployed directly, never used as a proxy implementation, so leave out DELEGATECALL into the pool's code from another contract. Also leave out reading the pool's storage by slot number (eth_getStorageAt or similar). Mark every mutant whose verdict would flip if either of these were included, in an extra column or a note, because that boundary is worth stating in the write-up.
