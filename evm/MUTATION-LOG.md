# Mutation log

What each round of review found in the tests for `src/ConstantProductPool.sol`, why the tests missed it, and what was added because of it.

A **mutant** is a copy of the pool with a deliberate bug in it. It **survives** if every test still passes, which means the tests would not have noticed that bug. Mutants are written by the reviewers or by a script, in scratch copies. None of them is in the contract. One counts only if it behaves differently from the correct pool on an input someone can name, so a new variable that nothing uses does not count.

Strictly, most of the mutants here are closer to fault injection. Standard mutation testing makes small edits to existing code, while most of these add code, as the table below shows.

## Is this much testing necessary?

The contract is simple, and it has held up. Across all the rounds, one change was made to it: refusing the same token twice. No round found a pricing, rounding or token-movement bug in it.

So the numbers below do not count problems in the code. They count ways the code could have been written wrong that the tests would not have noticed. That number is open-ended, because a reviewer can always imagine one more wrong pool, and this is why the rounds keep finding things even though the contract never changes.

Those tests matter here because the Ethereum article goes out before the conformance harness exists, so they are the only evidence that the Solidity matches the model.

The value of the rounds has not been even:

- **Rounds 1 to 3 found the gaps that mattered.** A hidden 0.1% fee, a pool that underpays from its second swap, and a minimum that stops working after the first swap all passed the tests at the time. Those are mistakes a person could make.
- **Round 4 was mixed.** A second trader's output going to the first is serious, but it took a reviewer inventing a pool that remembers its first caller.
- **Round 5 needs unusual setups.** Several of its mutants are mistakes nobody is likely to write, such as treating two tokens with one symbol as the same token. The unlimited approval is the exception, because real traders use those all the time.

The tests also grew faster than they had to. Rounds 3 to 5 added cases one at a time, and a fair part of that is now covered by the invariant handler. A pass that removes the overlap is planned but not yet approved.

## Test growth

The contract went from 101 to 106 lines over all of this. Code lines leave out blanks and comments, and the last column compares them with the contract's own.

| Stage | Tests | Test lines | Code lines | Against the contract |
|---|---|---|---|---|
| First version | 30 | 461 | 366 | 5.8x |
| After round 1 | 35 | not recorded | not recorded | not recorded |
| After round 2 | 42 | 681 | 535 | 8.2x |
| After round 3 | 52 | 822 | not recorded | not recorded |
| After round 4 | 62 | 996 | 784 | 12.1x |
| After round 5's fixes | 71 | 1195 | 940 | 14.5x |

Each invariant counts once per pool: 8 invariants on 3 pools make 24 of the 71 tests.

## What the mutants changed

Classified by hand from the diffs of rounds 3 to 5, so a few borderline cases could go either way. Rounds 1 and 2 were general reviews.

| Round | Mutants | Small edit to existing code | Added logic or a call | Added stored state | Added code |
|---|---|---|---|---|---|
| 3 | 31 | 11 | 15 | 5 | 65% |
| 4 | 41 | 14 | 20 | 7 | 66% |
| 5 | 27 | 5 | 22 | 0 | 81% |
| Total | 99 | 30 | 57 | 12 | 70% |

Small edits are a finite set, and they ran out quickly: all five in round 5 were rated low. New code has no such limit, which is why the rounds did not converge.

## Round 1: general review

**How:** five models read the code and looked for anything wrong, then checked each other's findings.

**Result:** nine findings. The pricing was right, and all 30 tests passed.

| Finding | Why it mattered | What changed |
|---|---|---|
| Fuzz tests discarded every refused swap | A pool refusing valid trades looked fine | Discard only when the output really is zero, and fail otherwise |
| Nothing pinned the formula | A hidden 0.1% fee passed | Worked example paying 50, and a property that the output is the largest that keeps the product |
| The minimum test claimed more than it checked | A wrong minimum passed | Fuzz minimums on both sides of the output |
| Constructor took the same token twice | A broken pool could be deployed | `IdenticalTokens`, the only contract change in any round |
| The event was tested in one direction | The direction could be hard-coded | A test the other way |
| Four wording and README fixes | They were simply wrong | Reworded |

**Why they were missed:** the first tests were checked against 13 deliberate bugs, none of which refused valid swaps or underpaid slightly.

## Round 2: general review

**How:** the same as round 1.

**Result:** thirteen findings plus two smaller ones, nine of them fixed and four deferred. All 24 deliberate bugs from round 1 were caught, and the serious ones got through anyway.

| Finding | Why it mattered | What changed |
|---|---|---|
| Output was only judged on a pool's first swap | A pool paying correctly once and underpaying afterwards passed all 35 tests | The handler judges every swap in a sequence, and a second invariant pool is small enough for rounding to matter |
| The return value was never compared with what moved | A pool could report 90 while paying 1, or pay the wrong address | Check reserves and both sides' balances on every swap |
| Fuzz range stopped well short of the overflow point | Bugs in large amounts passed | Range widened to just under 2^127 |
| Event tests could not see a change to the event | Reordered fields passed | A copy of the event in the tests |
| Tests that could not fail, and imprecise wording | They gave false comfort | Removed or reworded |

**Deferred:** unchecked token calls and the order of effects to chapter 5, a donation test to chapter 3, and a function that drains the pool to the security article. All of these are recorded in `ROADMAP.md`.

**Why they were missed:** everything so far looked at one swap, and trusted what `swap` returned.

## Round 3: write a pool that passes

**How:** the method changed here. Each model tried to write wrong pools that pass all 42 tests. A surviving pool is its own proof, so each one was rerun to confirm it instead of being cross-checked by the other models.

**Result:** 31 survivors, in nine kinds.

| Kind | Survivors | Example | Why the tests missed it | What was added |
|---|---|---|---|---|
| Minimum wrong after the first swap, or counting tokens the trader already held | 5 | After a swap pays 90, a minimum of 80 passes on a swap paying 75 | The handler always passed a minimum of zero, and minimum tests started from a fresh pool | Handler uses minimums the output just meets or misses |
| Pool takes more than `amountIn` | 2 | Approve 500, swap 100, lose 500 | Tests always approved the exact amount | A spare unit on every swap |
| Second `initialize` accepted | 3 | Reserves say 2000, balances say 3000 | The test only retried with identical amounts | Retry with different amounts and after a swap |
| Events lie, repeat or go missing | 9 | Pays 363, logs 24 | Events were checked once, on a balanced pool | Handler checks one correct event on every swap |
| Owner treated differently | 3 | Owner receives 90 without paying | The owner never traded | The owner trades, through the same checks |
| Huge amounts | 3 | Pricing through `k` cannot trade at 2^128 reserves | Fuzzing stops at 2^127 | Worked examples past the range |
| Refusals in one direction only | 4 | Wrong error for silver-for-gold | Refusal tests only went one way | Fuzz the direction |
| Trader short of funds gets a smaller trade | 1 | Holds 50, asks for 100, trades 50 | No test had a trader short of funds | A test for it |
| Handler's own flags rolled back | 1 | A garbage return from the third swap | A later revert in the handler undid the flag | `fail_on_revert`, and stop before arithmetic on a bad output |

**Side effect:** a run reported bugs as caught only because Foundry was replaying saved failures. That also exposed a misleading test failure, which was fixed.

**Why they were missed:** the tests only reached the situations they set up, and the setups were all alike: exact approvals, one trader and no minimum.

## Round 4: the same, on the fixed suite

**Result:** 41 distinct survivors against 52 tests.

| Kind | Example | Why the tests missed it | What was added |
|---|---|---|---|
| Second trader treated as the first | Bob pays and Alice gets his 75 | Each pool only ever had one caller | Handler trades as three people, one of them the owner |
| Owner skips the minimum | Owner pays below its own minimum | The owner's only test used a minimum of zero | The owner is one of the handler's traders |
| Pool leaves an approval behind | Trader drains another 90 after swapping | Nothing looked at what the pool approved | Each swap must log exactly its event and two others |
| `initialize` takes more than asked | Owner loses the rest of its balance | Setup always approved the exact amount | The spare unit also applies to `initialize` |
| Failed token pull ignored | Pool opens with no silver in it | Setup always had both tokens | A test that one missing token refuses `initialize` |
| Exact balance or approval refused | The most ordinary trade fails | The spare unit meant no swap spent everything | A setting to run with no spare |
| Reversed tokens or missing getters | `token0()` returns silver | Tests never read the getters or changed the order | Test the getters and both orders |
| Books go wrong after a donation | Every swap refused after one stray token | Nothing ever donated | A donation test |
| Ether, huge pools, error order | `swap` keeps ether sent to it | Not tested | Short tests for each |

**Accepted, not fixed:** a counter that refuses swaps after 65,536 of them. An invariant run makes 500 swaps, so it cannot get there, and a test for it would only cover that one number.

**Why they were missed:** the fixes from round 3 widened what one trader could do, but it was still one trader who always approved a little extra.

## Round 5: the same, on the fixed suite

**Result:** 27 distinct survivors against 62 tests. The laptop lost power during the last check, so these were rebuilt from the reviewers' reports, and two of them from descriptions and not exact diffs. All 27 pass under two seeds.

| Kind | Survivors | Severity | Why the tests missed it |
|---|---|---|---|
| Unlimited approval skips payment | 2 | high | The handler always replaced the approval with a finite one |
| Tokens in the other address order | 3 | high | Every traded pool had gold at the higher address |
| Donations reach silver-for-gold swaps | 4 | high or medium | The donation test only went gold-for-silver |
| Callers that are contracts, or `tx.origin` as the owner | 3 | medium | Outsiders were always plain addresses |
| Donations before `initialize` | 5 | medium, one low | Only gold was donated, and balances were not checked |
| Token symbols treated as identity | 1 | medium | Test tokens always had different symbols |
| Error order, huge amounts, payable constructor | 9 | low | Each was tried in one direction or on a funded caller |

**What was added:** this round was fixed mostly by making the handler richer, instead of adding a test per case. It now funds traders exactly, with a spare unit or with an unlimited approval. It also makes swaps that must be refused for an exact reason, donates to the pool, trades from a contract and from a direct wallet, and runs a third pool with its tokens reversed. The remaining examples, for `initialize`, ether and huge amounts, are short unit tests.

**Why they were missed:** by now each gap needed a setup nobody had thought to create, and the unit tests each checked a single case. The handler catches more per line, because each new condition it learns is tried across whole sequences of swaps.

## Round 6

In progress.
