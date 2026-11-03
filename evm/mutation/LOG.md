# Mutation log

What each round of review found in the tests for `src/ConstantProductPool.sol`, why the tests missed it, and what was added because of it.

A **mutant** is a copy of the pool with a deliberate bug in it. It **survives** if every test still passes, which means the tests would not have noticed that bug. Mutants are written by the reviewers or by a script, in scratch copies. None of them is in the contract. Each one is kept as a diff in this folder, and the [README](README.md) says how to run them again. One counts only if it behaves differently from the correct pool on an input someone can name, so a new variable that nothing uses does not count.

Strictly, most of the mutants here are closer to fault injection. Standard mutation testing makes small edits to existing code, while most of these add code, as the table below shows.

## Is this much testing necessary?

The contract is simple, and it has held up. Across all the rounds, one change was made to it: refusing the same token twice. No round found a pricing, rounding or token-movement bug in it.

So the numbers below do not count problems in the code. They count ways the code could have been written wrong that the tests would not have noticed. That number is open-ended, because a reviewer can always imagine one more wrong pool, and this is why the rounds keep finding things even though the contract never changes.

Those tests matter here because the Ethereum article goes out before the conformance harness exists, so they are the only evidence that the Solidity matches the model.

The value of the rounds has not been even:

- **Rounds 1 to 3 found the gaps that mattered.** A hidden 0.1% fee, a pool that underpays from its second swap, and a minimum that stops working after the first swap all passed the tests at the time. Those are mistakes a person could make.
- **Round 4 was mixed.** A second trader's output going to the first is serious, but it took a reviewer inventing a pool that remembers its first caller.
- **Round 5 needs unusual setups.** Several of its mutants are mistakes nobody is likely to write, such as treating two tokens with one symbol as the same token. The unlimited approval is the exception, because real traders use those all the time.

The tests also grew faster than they had to. Rounds 3 to 5 added cases one at a time, and a fair part of that is now covered by the invariant handler. A pass after round 6 merged or removed what other tests already cover, which turned out to be less than this suggests: see [Closing the gaps](#closing-the-gaps). A deeper cut followed, trading 13 of the bugs caught for 317 fewer lines: see [The deep trim](#the-deep-trim).

## Test growth

The contract went from 101 to 106 lines over all of this, and to 113 with the notes on overflow and on tokens that take a fee, which added no code. Code lines leave out blanks and comments, and the last column compares them with the contract's own.

| Stage | Tests | Test lines | Code lines | Against the contract |
|---|---|---|---|---|
| First version | 30 | 461 | 366 | 5.8x |
| After round 1 | 35 | not recorded | not recorded | not recorded |
| After round 2 | 42 | 681 | 535 | 8.2x |
| After round 3 | 52 | 822 | not recorded | not recorded |
| After round 4 | 62 | 996 | 784 | 12.1x |
| After round 5's fixes | 71 | 1193 | 940 | 14.5x |
| After closing the gaps | 65 | 1189 | 928 | 14.3x |
| After the deep trim | 38 | 872 | 670 | 10.3x |

Each invariant counts once per pool: 8 invariants on 3 pools make 24 of the 71 tests. Foundry 1.8.7 reports the same suite as 50 tests, the one after closing the gaps as 44, and the one after the deep trim, with one pool, as 31, because the invariants in one contract now share a campaign and count as one test. This log keeps counting them separately.

## What the mutants changed

Classified by hand from the diffs of rounds 3 to 5, so a few borderline cases could go either way. Rounds 1 and 2 were general reviews.

| Round | Mutants | Small edit to existing code | Added logic or a call | Added stored state | Added code |
|---|---|---|---|---|---|
| 3 | 31 | 11 | 15 | 5 | 65% |
| 4 | 41 | 14 | 20 | 7 | 66% |
| 5 | 27 | 5 | 22 | 0 | 81% |
| Total | 99 | 30 | 57 | 12 | 70% |

New code has no limit, which is why the rounds did not converge. Small edits are not exhausted by a tool, though: see the Gambit experiment below.

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

## Round 6: the same, on the fixed suite

**Result:** 29 distinct survivors against 71 tests, all confirmed under two seeds. None was fixed then, because the rounds stopped here for the Gambit experiment. The ones rated likely or possible were closed later: see [Closing the gaps](#closing-the-gaps). For the first time, reviewers rated how realistic each mistake is.

| Kind | Severity | Realistic? | Why the tests miss it |
|---|---|---|---|
| Balance checked before the token's own allowance check | low | likely | Only a trader short of both shows it, and then only the error differs |
| `initialize` measuring reserves from crossed balances | high | possible | The donation test gave both tokens the same amount |
| Unlimited approval at `initialize` | medium | possible or unlikely | Only swaps use unlimited approvals |
| Balance required to cover a larger approval | medium | possible | Traders holding less than they approved always had exact approvals |
| Decimals used in pricing or the constructor | high or medium | possible | All test tokens have 18 decimals |
| Constructor reads the deployer's wallet | medium | possible or unlikely | Tests deploy before minting |
| Short trader with a spare approval pays what they have | high | unlikely | Short traders always approved the exact amount |
| Fee depending on the block, or on holding far more than the trade | high | unlikely | No test moves the block, and traders hold little |
| Constructor approves the owner | high | unlikely | A backdoor more than a mistake |
| Other `initialize` and error-order cases, and amounts near 2^256 | low | mostly unlikely | Each needs one specific setup |

**Why it stopped:** one model found no realistic mistake at all, and another found only low ones. Most of what is left is deliberate behaviour, or needs a setup that only happens once.

## Gambit experiment

**Question:** would tests driven only by a mutation tool catch the same bugs? Gambit makes the same small edits every time, which removes the guesswork. It made 83 mutants of the contract, the same 83 with every operator on.

**How:** the same contract with the original 30 tests, adding only what Gambit asked for. That was one test, for the same-token check, because the 30 tests already caught the other 82. Hand-made bugs were then run against both suites, with a clean cache and under two seeds. The rounds 3 to 5 set is rebuilt from the reviewers' reports, with duplicates removed, so it holds 82 of the 99.

| Bugs | Count | Gambit suite (31 tests, 464 lines) | Current suite (71 tests, 1193 lines) |
|---|---|---|---|
| Gambit's mutants | 83 | 83 | 83 |
| Scripted bugs from rounds 1 and 2 | 39 | 20 | 39 |
| Rounds 3 to 5 | 82 | 5 | 81 |
| Round 6 | 29 | 0 | 0 |

The current suite's 81 leaves out `r4-internal-getters`, which does not compile against those tests, so it was refused rather than caught.

**What it showed:** a suite that passes every Gambit mutant still passes a pool with a hidden 0.1% fee, one that underpays from its second swap, and one that sends a second trader's output to the first. It also misses all 25 of the small-edit bugs among the rebuilt ones, so Gambit's edits are not all the small edits there are.

Gambit is a cheap check that the tests still work, not a measure of when they are good enough. The hand-made bugs were written for the current suite, so this comparison favours it, and it is one small contract.

## Foundry 1.8.7

The upgrade from 1.7.1 changed how invariants run. The boolean invariants in one contract now share a campaign, so a full run makes 150,000 invariant calls instead of 1,200,000, while each invariant is still checked against 50,000. They now see fewer distinct call sequences.

All bugs that were caught before were rerun at the reduced budget, to see whether the smaller campaign lost any. None was lost: 83 of 83 Gambit mutants, 39 of 39 scripted bugs, and 81 of the rounds 3 to 5 set, with `r4-internal-getters` still refused at compile time. The 29 round 6 survivors still pass.

The new `missing-events-arithmetic` lint is turned off in `foundry.toml`. It points at `initialize` setting the reserves with no event of its own, but the two token transfers in the same call log both amounts.

## Tool comparison

**Question:** does any other mutation tool do better than Gambit? The test was the same: start from the original 30 tests, add only what each tool's surviving mutants ask for, then run the hand-made bugs against the result. All tools ran on the same contract under Foundry 1.8.7, and solc 0.8.38 worked in all of them.

**How:** each tool's mutants were compiled and compared by bytecode, dropping any that fail or that repeat another. Every mutant then went through the same scorer: its own copy, a clean cache, seeds 1 and 7, and the reduced invariant budget. Equivalent mutants were judged by hand, and all also pass the current suite. A [second check](#the-second-check-of-the-equivalent-mutants) later found that one of the 35 is a real gap, and the counts below include it.

| Tool | Mutants made | Usable | Survive the 30 tests | Real gaps | Tests added | Suite lines | Hand-made bugs caught, of 233 |
|---|---|---|---|---|---|---|---|
| Gambit | 83 | 83 | 1 | 1 | 1 | 464 | 108 |
| `slither-mutate` | 115 | 114 | 5 | 1 | 1 | 464 | 108 |
| SuMo | 64 | 63 | 4 | 2 | 2 | 469 | 110 |
| `forge test --mutate` | 139 | 133 | 18 | 4 | 4 | 482 | 109 |
| `universalmutator --swap` | 1134 | 240 | 48 | 15 | 9 | 526 | 118 |
| All tools together | | 352 | 51 | 16 | 10 | 533 | 118 |
| Current suite | | | | | 41 | 1193 | 203 |

Three of universalmutator's real gaps got no test. Two need a token that calls back into the pool, which is deferred to chapter 5, and the third shows only to a static call, and was found after the tests were added. The bug counts include `r4-internal-getters` as missed. Of the 233 bugs, Gambit's 83 are all caught by every suite, and the round 6 bugs by none.

**What it showed:** the tools found something the rounds did not. `if (msg.sender < owner) revert NotOwner();` passes all 71 current tests, even at the full budget, so a pool that lets any address above the owner initialize it would go unnoticed. Six rounds missed this because every outsider the tests try has an address below the owner's. `forge test --mutate` and universalmutator made this mutant. Gambit has no comparison swaps, and Slither's skip address operands.

The current suite also passes four other real mutants, all line swaps from universalmutator: the two token pulls in `initialize` in the opposite order, `initialize` booking `reserve0` before it checks the amounts, which only a static call can see, and the two chapter 5 cases.

Most survivors are not gaps. 34 of the 51 are equivalent, mostly because a `uint256` cannot be below zero, the reserves are only ever zero together, or two lines can run in either order.

More mutants did not mean much better tests. All five tools together caught 118 of the 233, against 203 for the current suite. A test can do more than the mutant that prompted it, though: `test_SwapWorksOnAReserveOfOne` exists for a changed literal, and its exact answer also catches the hidden 0.1% fee.

**The tools in use:**

- `forge test --mutate` needs nothing installed, and listing its mutants took 1.6 seconds. Running them was far slower: about a minute each on the 30 tests, from the few that finished before it was stopped. It also skips related mutants once one survives. Its mutants here were scored by the shared scorer, not by its own run.
- universalmutator found the most: 15 of the 16 real gaps, including the line swaps no other tool makes. Its regex rules made the most mutants that do not compile, 76%, but the compiler throws those out in seconds. What takes a person's time is judging survivors, and there it was the more precise: 15 of its 48 were real, against 4 of forge's 18.
- SuMo needed three workarounds to run outside an npm project, and it added one real mutant beyond Gambit and Slither.
- `slither-mutate` added nothing over Gambit here, though it did handle solc 0.8.38.

**Which to use:** `forge test --mutate` as the quick check on changed code, since it is already installed, and universalmutator with `--swap` as the fuller pass before a release. Gambit, `slither-mutate` and SuMo found no real gap that these two did not.

As before, the hand-made bugs were written for the current suite, so that column favours it, and this is one small contract.

## Closing the gaps

**What:** tests for the two real gaps the tools found that the suite still missed, the owner comparison and the order of the token pulls, and for the round 6 mistakes rated likely or possible. Then a pass that merges or removes tests that others already cover.

**Added:**

- An outsider whose address is above the owner's is refused.
- `initialize` asks for gold first.
- `initialize` with an unlimited approval takes only the amounts given.
- Unequal donations before the pool opens, so that crossed balances cannot cancel out.
- A trader short of both funds and approval is refused for the approval, which the token checks first.
- A token with 6 decimals, as USDC has, trades as one with 18 does.
- The handler also trades with an approval of a unit more than the trader holds.

**The overlap pass:** all 585 bugs, the 233 hand-made ones and the 352 tool mutants, were run against the suite, recording which tests fail for each under both seeds. Most tests are never the only one to catch a bug, but most of those are the model's worked examples and properties, which the Ethereum article quotes, so they stay. Five pairs that each ran one direction or one step were merged, and three tests were removed because the handler does the same on every pool: exact balances, a swap from a wallet directly, and the minimum checked before tokens move. Two stay although the handler covers them: the owner trading like anyone else, without which four owner bugs would rest on the campaigns alone, and the trader short of funds, beside the one short of an approval.

| | Before | After |
|---|---|---|
| Tests | 71 | 65 |
| Test lines | 1193 | 1189 |
| Hand-made bugs caught, of 233 | 203 | 215 |
| Tool mutants caught, of 352 | 306 | 308 |

The suite after the pass catches exactly what it caught before it, bug for bug, under both seeds. What still passes is the 17 round 6 bugs rated unlikely, the 34 equivalent mutants, the static-call case and the two chapter 5 cases. `r4-internal-getters` and 7 tool mutants do not compile against the tests: five remove a getter, one swaps the order of `swap`'s parameters, and one removes the constructor.

## The deep trim

**Why:** the suite had grown to 1189 lines for a contract of 65 code lines. Two reviews of the contract and its tests, by Fable and Astra, found no serious defect in the contract and judged the suite partly bloat: rounds 1 to 3 found gaps a person could leave, and later rounds mostly chased bugs someone had to invent. The conformance harness will run the model's own properties against the contract, which replaces most of the model checks here, so the suite was cut to what the Ethereum article needs and then scored against all 585 bugs again.

**Cut:**

- Two of the three invariant pools, the large one and the one with the tokens in the other order. The one left trades as three people, the owner among them, with no contract caller and no `tx.origin` variants, and without the handler's action that only made refused swaps.
- Tests the handler or a fuzzed test already covers: the exact minimum, the tokens moving on a swap, a trader short of funds and one short of an approval (now one fuzzed test), and `initialize` taking gold first.
- Short tests from round 4 and 5: ether sent to the pool, a reserve near 2^256 on the way out, an amount with the top bit set, a second `initialize` on a huge pool.
- Exact errors where a call fails for the token's reason, not the pool's: those tests now only check that the call reverts.

**Restored after the first score:** the first cut caught 498 of the 585. Eleven of the bugs it lost were mistakes a person could make, and they came back:

- A minimum checked only at one above the output: the minimum test fuzzes one above it too.
- A second `initialize` accepted with other amounts or after a trade, or one of two empty reserves allowed.
- The pool approving the trader: every worked trade checks that the pool leaves no approval behind.
- The minimum checked before the empty pool: the empty-pool test fuzzes the minimum.
- Outsiders above the owner, and contracts, getting past the owner check.
- `initialize` pulling only what the pool lacks after a donation.
- A balance required to cover a larger approval: the handler sometimes approves two units above the balance.

| | Before | After |
|---|---|---|
| Tests | 65 | 38 |
| Test lines | 1189 | 872 |
| Code lines | 928 | 670 |
| Hand-made bugs caught, of 233 | 215 | 204 |
| Tool mutants caught, of 352 | 308 | 306 |

**What it lost:** 15 bugs, none a wrong price, a wrong payment or a swap let through.

- Eight change only which error a call that fails anyway reverts with, or where in the call it reverts: three balance checks before the token's own (round 6), the minimum or the zero output checked after the transfers, a funds check in one direction, `initialize`'s amount check moved, and its two token pulls in the other order. The last was one of the real gaps the tools found, and it shows only in which token logs first.
- `initialize` or the constructor accepting ether.
- The second-`initialize` guard written as `reserve0 * reserve1` or `reserve0 + reserve1`, which differs only once the reserves overflow, and then still reverts.
- A silver reserve at 2^255 or above read as empty.
- Two that round 5 rated medium: `swap` refusing callers that are contracts, other than the owner, and the constructor taking two tokens with one symbol for the same token. Both are checks someone would have to add, not slips in code that is there.

It gained two: the constructor approving the owner, which the owner's trade now catches, and a fee charged to traders holding far more than the trade, which the handler's traders now catch.

The bugs still not caught are the 34 equivalent mutants, the static-call case, the two chapter 5 cases, the round 6 bugs rated unlikely, and the 15 above. `r4-internal-getters` and 7 tool mutants still do not compile against the tests. The results are in [results/trim/](results/trim).

## The second check of the equivalent mutants

**Question:** are the 35 mutants judged equivalent really so? They were judged once, by hand, by the agent that ran the comparison.

**How:** a second reviewer, GPT-6.1 Sol, got the contract and 39 mutants under neutral names: the 35 and the four real gaps beside them. It did not see the first judgment or how many were equivalent, and it could not run forge. Its brief is [briefs/equivalent-check.md](briefs/equivalent-check.md), and its verdicts are in [reviewers/equivalent-check/](reviewers/equivalent-check).

**What it showed:** it found all four gaps, and it agreed on 34 of the 35. The other, `587edcd7f5b9`, books `reserve0` before `initialize` checks the amounts. The first judgment said the check's revert undoes the write, but a static call forbids any write, even of zero over zero. So when the owner static-calls `initialize(0, 1)`, the pool reverts with `AmountNotPositive` and the mutant reverts with no data. A forge test confirmed it. It stays open on purpose, since no caller has a reason to static-call `initialize`.

It also asked where equivalence stops. The answer was the pool as deployed, static calls included. Running its code by DELEGATECALL from another contract, or reading its storage by slot number, would tell apart 16 of the 34, but nothing does either to this pool. [equivalent.md](equivalent.md) names them.

## Timing the tools

**Question:** how long does a full scoring run take for each tool?

**How:** each tool's usable mutants went through [scripts/score.sh](scripts/score.sh), one tool after another: two at a time, seeds 1 and 7, the reduced invariant budget. Mutants that two tools share were scored once per tool, as each tool's user would. Every outcome matched the stored per-test results.

| Tool | Mutants | Trimmed suite | Suite after the overlap pass | Not caught by the trimmed suite |
|---|---|---|---|---|
| Gambit | 83 | 1 min 39 s | 2 min 14 s | 0 |
| SuMo | 63 | 1 min 38 s | 2 min 16 s | 2, and 1 that does not compile against the tests |
| `slither-mutate` | 114 | 2 min 36 s | 3 min 44 s | 4 |
| `forge test --mutate` | 133 | 3 min 15 s | 4 min 28 s | 14 |
| `universalmutator --swap` | 240 | 6 min 23 s | 8 min 50 s | 38, and 6 that do not compile against the tests |

**What it showed:** scoring costs 1.2 to 1.6 seconds a mutant, so all five tools take about 15 minutes against the trimmed suite, and the trim made it about 30% faster. The time follows the number of usable mutants, which is why universalmutator costs most. These times leave out making the mutants and compiling them to drop the duplicates, and each tool's own runner: `forge test --mutate` took about a minute a mutant with its own runner, on the 30 tests. The whole run used 0.16 Wh of battery. The results are in [results/timing/](results/timing).
