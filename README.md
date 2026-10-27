# AMM series

Automated market makers built from didactically simple to "real-ish", on Ethereum and Solana, with a
Haskell model as the specification. Each chapter is written up as articles on
[blog.raduom.ro](https://blog.raduom.ro). See [ROADMAP.md](ROADMAP.md) for the plan and the chapters.

## Toolchain

Install each toolchain with its version manager, following the manager's own instructions for your
operating system, then install the versions below. These are the versions the repository is tested
with; pin files in the repository select them automatically where a manager supports one.

| Toolchain | Manager | Tested version | Pinned by |
|---|---|---|---|
| GHC / cabal / HLS | [ghcup](https://www.haskell.org/ghcup/) | 9.14.1 / 3.18.2.0 / 2.15.0.0 | `cabal.project` (GHC) |
| Rust | [rustup](https://rustup.rs) | 1.99.1 | `rust-toolchain.toml` |
| Node / npm | [nvm](https://github.com/nvm-sh/nvm) | 26.12.1 / 11.20.0 | `.nvmrc` |
| Foundry | [foundryup](https://getfoundry.sh) | 1.7.1 | — |
| Anchor | [avm](https://www.anchor-lang.com/docs/installation), installed with `cargo install` from the Anchor repository | 1.2.1 | — |
| Solana CLI | Anza's installer (`agave-install`) | 3.1.10 | — |

- Use cabal, not stack: Stackage has no GHC 9.14 snapshot yet.
- Anchor installs and activates the Solana CLI version it recommends (3.1.10 for Anchor 1.2.1) the
  first time it runs, replacing whichever version was active. Installing Anchor first is enough.
- The Solana CLI lives in `~/.local/share/solana/install/active_release/bin`, which has to be on
  `PATH`; `agave-install` must be found there for Anchor to switch versions.

Libraries are fetched by each package manager. The versions tested so far:

| Library | Version | Used for |
|---|---|---|
| QuickCheck, tasty, tasty-quickcheck | 2.19, 1.5.5, 0.11.1 | model properties |
| quickcheck-dynamic, aeson, typed-process | 4.0.1, 2.3.2, 0.2.13 | conformance harness (planned) |
| LiteSVM | 0.18.x | in-process Solana tests and driver (planned) |
| revm | 43.x | in-process EVM driver (planned) |

## Running

```sh
cabal test all          # model properties
cd web && npm install
npm run dev             # interactive pages, served by Vite
```
