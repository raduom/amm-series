# Roadmap

A series that builds automated market makers (AMMs) from didactically simple to "real-ish", on
Ethereum and Solana, with a Haskell model as the specification. Each chapter is written up as one or
more articles on [blog.raduom.ro](https://blog.raduom.ro).

Status: **chapter 1 in progress**. Chapter contents are provisional and will change as the subject
becomes clearer; the order is fixed.

## Principles

- **The model is the specification.** Every chapter starts with a small Haskell model. Contracts
  are implementations of that model, not the other way around.
- **Readable first.** Model code is written to be quoted in an article: plain `Integer`, total
  functions, no cleverness. Even when the code is trivial, the article shows running Haskell.
- **Properties, then conformance.** QuickCheck checks economic and safety properties of the model,
  then checks that both deployed implementations agree with the model on random action sequences.
- **First to last, stoppable anywhere.** Chapters build on each other in order, but each finished
  chapter is a complete, publishable unit. The series can end after any chapter.
- **Break it on purpose.** Each chapter has a security section: what goes wrong, shown as a
  counterexample or an exploit test, not only described.

## Architecture

Two Haskell layers, two implementations, two drivers.

```
model/  AMM.*           readable models — what articles quote
        AMM.Harness.*   quickcheck-dynamic state models, protocol, process handling
                │
                │  JSON-lines action protocol (stdin/stdout)
                ├──► drivers/evm-driver  Rust + revm, runs Foundry-compiled bytecode in-process
                └──► drivers/svm-driver  Rust + LiteSVM, runs the compiled Anchor program in-process
```

- **Model layer** (`AMM.ConstantSum`, `AMM.ConstantProduct`, …): pure state, actions, results and
  errors. Readers should be able to follow it without knowing Haskell well.
- **Harness layer**: generates action sequences (quickcheck-dynamic), runs them against the model
  and a driver, and compares results and state after every step. Shrinking turns a failure into a
  minimal action sequence that an article can quote.
- **Drivers**: one small Rust process per chain. Both speak the same protocol, so a chapter's
  conformance test is written once and runs against both chains. In-process execution keeps
  thousands of test cases fast; testnets are for deployment, not for property runs.
- **Native tests stay**: Foundry unit/fuzz tests and LiteSVM tests cover chain-specific behaviour
  (access control, account validation, events) that the shared model does not describe.
- **Naming**: the model uses names a reader can follow (`gold`/`silver`, `Direction` with
  `GoldForSilver`/`SilverForGold`), while Solidity and Rust keep the on-chain conventions
  (`token0`/`token1`, `zeroForOne`). The mapping is stated once, where chain code first appears;
  names that already read well (`amountIn`, `minAmountOut`, …) stay the same everywhere.

## Planned layout

```
model/        Haskell package: models, properties, harness, one runnable demo per chapter
evm/          Foundry project (Solidity)
solana/       Anchor workspace
drivers/      evm-driver, svm-driver (Rust)
web/          interactive pages that mirror each chapter's model, for teaching (TypeScript)
security/     one note per chapter: threat model, findings, exploit tests
deployments/  testnet addresses and program IDs (Sepolia, Solana devnet)
scripts/      repository checks
```

## Definition of done (per chapter)

1. Haskell model with properties passing, and a runnable demo (`cabal run chNN`).
2. Interactive page for the chapter's model.
3. Solidity implementation with Foundry tests.
4. Anchor implementation with LiteSVM tests.
5. Conformance: the chapter's action sequences agree between model, EVM and SVM.
6. Security note with exploit or counterexample tests.
7. Deployed to Sepolia and Solana devnet, recorded in `deployments/`.
8. Git tag `chNN` marking the finished chapter. Steps inside a chapter get their own tags
   (`chNN-<step>`, e.g. `ch01-model`, `ch01-evm`) once their article is published, so each article
   links to code that matches it.

Start the next chapter only after the current one is done.

## Chapters

| # | Chapter | New idea | Security focus | Status |
|---|---|---|---|---|
| 1 | Constant sum | Pools, reserves, swaps at a fixed price | Drained when the market price moves; decimals mismatch | in progress |
| 2 | Constant product | `x · y = k`, price impact, slippage | Missing minimum output, sandwiching | planned |
| 3 | Fees and LP shares | Providing liquidity, mint/burn, fees | First-depositor (inflation) attack, donations | planned |
| 4 | Integer arithmetic | Rounding direction, overflow, fixed point | Rounding-drain sequences | planned |
| 5 | Uniswap V2-style | Router, flash swaps, TWAP oracle | Reentrancy and CPI, fee-on-transfer / Token-2022, oracle manipulation | planned |
| 6 | Adversarial trading | An adversary in the model | MEV, slippage tolerance, deadlines | planned |
| 7 | StableSwap | Curve's invariant, Newton iteration | Non-convergence, amplification changes | planned |
| 8 | Weighted pools | Balancer's invariant, fixed-point pow/ln | Approximation and rounding errors | planned |
| 9 | Concentrated liquidity | Ticks, √price, ranged positions (simplified) | Tick-crossing bugs, JIT liquidity | planned |

### 1. Constant sum

The simplest pool: trade gold and silver 1:1, keep `gold + silver` constant. Liquidity is
owner-provided; no LP shares yet.

- Model properties: the sum is preserved; output equals input; a swap followed by its reverse
  restores the pool; reserves never go negative.
- The interesting property is the one that fails: "the pool's value at the market price never
  decreases". QuickCheck finds the drain.
- Solana angle: accounts, PDAs and token vaults versus contract storage.
- Leads to: a price that moves with the reserves.

### 2. Constant product

`x · y = k` without fees: output `y · dx / (x + dx)`, rounded down.

- Model properties: `k` never decreases; output is always below the reserve; larger trades get
  worse prices; a round trip never profits.
- Security: a swap without a minimum output, shown with an adversary trading before the user.
- Leads to: who provides liquidity, and why would they?

### 3. Fees and LP shares

A fee on every swap and shares for liquidity providers (first deposit `√(x · y)`, minus a minimum
locked amount; later deposits proportional).

- Model properties: share value never decreases; burning returns a proportional slice; fees accrue
  to holders.
- Security: first-depositor inflation attack; tracked reserves versus actual balances.
- Leads to: rounding is everywhere, and someone gets the remainder.

### 4. Integer arithmetic

The same pools under the microscope: an exact `Rational` model next to the on-chain `Integer` one.

- Model properties: every rounding favours the pool; the gap to the exact model stays bounded;
  intermediate values fit their on-chain types (`uint256`/`uint112` on EVM, `u64`/`u128` on
  Solana).
- Security: action sequences that extract value through rounding.
- Leads to: what a production pool adds around the core.

### 5. Uniswap V2-style

Router and multi-hop swaps, flash swaps, price accumulators for a TWAP oracle, `skim`/`sync`.

- Security: reentrancy (EVM) versus CPI rules (Solana); fee-on-transfer tokens and Token-2022
  transfer fees; spot price versus TWAP manipulation.
- Leads to: the pool is correct, but the trader still loses.

### 6. Adversarial trading

Add an adversary who chooses transaction order.

- Model properties: sandwich profit is bounded by the user's slippage tolerance; deadlines bound
  stale execution.
- Ordering differs between chains (public mempool versus leader scheduling and bundles). Those
  claims are version-sensitive; verify them when the chapter starts.
- Leads to: constant product is wasteful for assets that should trade near 1:1.

### 7. StableSwap

Curve's invariant: constant-sum near balance, constant-product far from it. `D` is found by Newton
iteration.

- Model properties: iteration converges within a bound; price stays near 1:1 near balance.
- Security: non-convergence, changes to the amplification factor.

### 8. Weighted pools

Balancer's invariant `∏ Bᵢ^wᵢ` with non-equal weights and fixed-point `pow`/`ln`.

- Model properties: approximation error stays bounded and rounds in the pool's favour.
- Security: rounding and approximation exploits. Find and verify real incidents when the chapter
  starts.

### 9. Concentrated liquidity (simplified)

Uniswap V3 mechanics: liquidity in price ranges, ticks, `√price`. Scope is "the mechanics,
simplified", not a full clone; this chapter may split in two.

- Model properties: a swap across ticks equals a sequence of single-range swaps; liquidity is
  conserved when crossing ticks.
- Security: tick-crossing bugs, just-in-time liquidity.

## Toolchain

| Tool | Version | Notes |
|---|---|---|
| GHC / cabal / HLS | 9.14.1 / 3.18.2.0 / 2.14.0.0 | via ghcup; cabal, not stack (Stackage has no 9.14 snapshot yet) |
| Haskell libraries | QuickCheck 2.19, quickcheck-dynamic 4.0.1, tasty 1.5.5, tasty-quickcheck 0.11.1, aeson 2.3.2, typed-process 0.2.13 | verified to build on 9.14.1 (2026-10-21) |
| Foundry | 1.7.1 | Solidity, tests, Sepolia deploys |
| Anchor | 1.2.x | `anchor-lang`/`anchor-spl`; CLI not installed yet (Homebrew `anchor` formula is 1.2.1) |
| LiteSVM | 0.18.x | in-process Solana tests and driver |
| revm | 43.x | in-process EVM driver |
| Solana CLI | 4.3.1 | `~/.local/share/solana/install/active_release/bin`, not on PATH by default |

## Open questions

- Should the drivers live in one Cargo workspace with the Anchor program or separately?
  (Dependency versions between Anchor, LiteSVM and revm may decide this.)
- How should testnet keys and RPC endpoints be handled? Nothing secret is committed; decide before
  the first deployment.
