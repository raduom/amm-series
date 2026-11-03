# Tool research: Review Slither and Foundry mutators

Sent on 2026-11-02 to a research subagent.

## Brief

Read these pages and answer from them only, saying plainly where a page does not answer: https://secure-contracts.com/program-analysis/slither/docs/src/tools/Mutator.html , https://deepwiki.com/crytic/slither/6.1-mutation-testing , https://www.github.com/crytic/slither/releases , https://github.com/crytic/slither/tree/master/slither/tools/mutator/mutators , https://getfoundry.sh/guides/mutation-testing , https://foundry-rs.github.io/foundry/forge/mutation/mutators/index.html
For slither-mutate: (1) every mutator name with what it changes, exactly, e.g. what ROR swaps, what MIA, MVIE, MVIV, LIR, SBR, FHR, MWA, RR, CR do; does any add or subtract a constant, or change a literal? (2) install method and Python version needed; (3) how it decides a mutant is killed, and how it runs tests (does it run forge test once per mutant, with timeouts); whether a Foundry project with remappings and git submodules needs anything special; (4) solc handling: does it need solc-select, any stated Solidity version limits, does it support 0.8.38 or evm_version osaka; (5) latest release version and date.
For Foundry's forge test --mutate: (6) which forge version introduced it, is it in stable or nightly, and the exact mutations each operator group makes (binary-op, unary-op, assignment, delete-expression, require, elim-delegate, assembly), including whether comparison operators are swapped; (7) its stated restrictions, and whether invariant tests are included.
