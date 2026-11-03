# Round 2: each reviewer checks the others' findings

Sent on 2026-10-31 to each reviewer below, with `<reviewer>` standing for its short name (opus, sol, grok, fable, astra). Each worked in its own T3 Code thread, which holds its full report.

| Reviewer | Model | Options |
|---|---|---|
| Opus 5.5 | `claude-opus-5-5` | `{"effort": "high"}` |
| GPT-6.1 Sol | `gpt-6.1-sol` | `{"reasoningEffort": "high"}` |
| Grok 4.7 slow | `grok-4.7` | `{"reasoning_effort": "high", "fastMode": false}` |
| Fable 5.1 | `claude-fable-5-1` | `{"effort": "high"}` |
| GPT-6 Astra xhigh | `gpt-6-astra` | `{"reasoningEffort": "xhigh"}` |

## Brief

Cross-check round of a code review, read-only. Do not start subagents. Treat the 13 claims below as unverified: some may be wrong, overstated or understated. Try to refute each one, and judge it on the code and on what you can run.

Repository: /home/raduom/Spaces/amm-series, branch `evm-pool`, HEAD 063dc51, with uncommitted changes in the working tree that are part of this review (`git diff HEAD`). It is a teaching series: the Haskell model `model/src/AMM/ConstantProduct.hs` is the specification and `evm/src/ConstantProductPool.sol` implements it. Tests are in `evm/test/`. The chapter 2 pool has one owner who supplies all liquidity. The roadmap publishes the Ethereum article before any model-versus-contract conformance harness exists, so Foundry tests are the only evidence behind that article; the planned harness will later compare results, reserves and balances after every step of random sequences. Chapter 3 adds LP shares and deals with tracked reserves versus balances; chapter 5 deals with reentrancy and non-standard tokens. Judge each claim partly on whether it belongs in this chapter or can wait, and say so.

Claims:

G1. `evm/test/ConstantProductPool.invariant.t.sol:41-53`: output is judged only on a pool's first swap. The handler checks only that the product does not fall and that paying swaps are not refused, so underpayment from the second swap onward passes. Mutants said to survive all 35 tests: subtract one output unit after the first successful swap; `if (swapCount++ > 0) amountOut -= amountOut / 100;`. From (1000, 1000), two gold inputs of 100 should return 90 then 75; the mutant returns 90 then 74. Invariant runs also start only from one large pool, 1e24 and 4e24, so sequences on small pools where rounding matters are never tried. Proposed fix: capture the handler's return value and apply the two-sided check from `testFuzz_OutputIsTheLargestThatKeepsTheProduct` with pre-swap reserves, recording a sticky flag that an invariant asserts; consider a second invariant contract with a small pool.

G2. `evm/test/ConstantProductPool.t.sol:44-51` and the invariant handler: fuzz tests trust `swap`'s return value. Nothing checks it against the reserve change or the tokens moved, except at the fixed input 100. Mutants said to survive all 35 tests: return and emit 47 but subtract and transfer 46 for most inputs; `tokenOut.safeTransfer(msg.sender, uint96(amountOut))`; send the payout to the owner from the second swap onward; pay `minAmountOut` while returning the full output, reported as (1000, 1000), input 100, minimum 1, returning 90 while transferring 1 with reserves (1100, 999). Proposed fix: in `trade` and in the handler, assert the exact reserves after the swap, pool balances equal to reserves, and the trader's input debit and output credit.

G3. `evm/src/ConstantProductPool.sol:68-69,103-104`, `evm/test/TestToken.sol:7`: nothing tests the SafeERC20 calls. OpenZeppelin's ERC-20 reverts on failure and never returns `false`, so replacing `safeTransfer` and `safeTransferFrom` with unchecked calls is said to pass all 35 tests; with a token whose `transferFrom` returns false, such a pool pays out without being paid. Proposed fix: add a false-returning token and a USDT-style token with no return value, testing `initialize` and both swap legs. Counter-view: non-standard tokens are chapter 5.

G4. `evm/test/ConstantProductPool.t.sol:15`: the fuzz range stops at `uint112.max` although the contract is correct up to the overflow point. Mutant said to survive: `uint256(uint240(reserveOut * amountIn))`, mispricing at `reserveOut = amountIn = 2^125`. Proposed fix: `MAX_AMOUNT = type(uint128).max >> 1`. Check whether every helper and assertion stays free of overflow at that bound, including `amountIn + extra`, `(out + 1) * largerIn`, and the product checks.

G5. `evm/test/ConstantProductPool.t.sol:391,400`: the event tests emit `ConstantProductPool.Swap`, the contract's own definition, so changing that definition, such as removing `indexed` from `trader`, is mirrored in the expectation and survives. Proposed fix: declare a copy of the event in the test.

G6. `evm/src/ConstantProductPool.sol:24-25`: no test shows that a donation leaves the price unchanged. With 1000/1000 and 9000 gold donated, a 100 gold swap should pay 90; a pool that prices from `balanceOf` pays 9 and survives. Proposed fix: add `test_DonationDoesNotMoveThePrice`, or leave it for chapter 3. Note that `invariant_ReservesMatchBalances` would be false after a donation, so check how a donation test relates to that invariant.

G7. `evm/test/ConstantProductPool.t.sol:418-419,427-429`: the assertions in the two "ChangesNothing" tests cannot fail, because once `expectRevert` passes the call has already rolled back. Proposed fix: drop the assertions and rename the tests after the refusal they check.

G8. `evm/src/ConstantProductPool.sol:11-12`, `model/src/AMM/ConstantProduct.hs:4`, `web/index.html:23`: "rounded down so it can only grow" is not quite true, since the product can stay the same, as `test_SwapAtAnExactQuotient` shows: 100 × 100 and 200 × 50 are both 10000. Proposed fix: say "so it never falls" in all three places. Note that `web/index.html:23` is already on `main`.

G9. `evm/src/ConstantProductPool.sol:100`: the comment "the books are settled before any other contract runs", and the commit message "Update the reserves before moving tokens", state an ordering the suite cannot check: moving the reserve updates after the transfers survives all tests, and so does paying out before taking payment. Proposed fix: soften the comment to describe intent, or add a callback token that observes the reserves. Counter-view: reentrancy is chapter 5.

G10. `evm/src/ConstantProductPool.sol:57-58`: the `initialize` doc says "The model starts from a pool that already holds both tokens", but the model's `Pool` can be empty and `EmptyPool` exists for that case. Proposed fix: "The model's swap needs a pool that holds both tokens; this is how one comes to exist."

G11. `evm/foundry.toml:2`: `evm_version` is not pinned. `forge config` reports the inherited default `osaka`, so bytecode can vary with the Foundry version, and the planned revm driver has to support whatever it is. Proposed fix: pin it next to `solc` and list it in the README.

G12. `ROADMAP.md:46-48`: the Architecture section says native tests cover chain-specific behaviour the model does not describe, but this suite also ports the model's six properties, which are the only evidence behind the Ethereum article until the harness exists. Proposed fix: add a clause saying so.

G13. No test covers the contract's surface: a public `sweep()` that drains the pool is said to survive all 35 tests. Decide whether this is a real gap or an unavoidable limit of testing, and whether any reasonable test would help.

Rules: do not edit, stage, commit or push anything in the repository. `forge` is at ~/.config/.foundry/bin/forge (not on PATH). To experiment, copy `evm/src`, `evm/test` and `evm/foundry.toml` from the working tree to a fresh `mktemp -d` directory, symlink `lib` to /home/raduom/Spaces/amm-series/evm/lib, `cd` into that temporary directory, and run `forge test` there. Never run forge with the repository as your working directory, even with `--root`, because failure caches are written relative to the working directory. Other reviewers are using this checkout. Reproduce the mutant claims; do not take them on trust.

Return one entry per claim: G-number; verdict CONFIRMED, PARTLY or REJECTED; your severity (high/medium/low/none); fix now or defer, and to which chapter; whether you reproduced it and how; whether the proposed fix is right; and one or two sentences of reasoning. Say so if a proposed fix is wrong or insufficient. Report a new defect only if you noticed one while checking, in a separate short list.
