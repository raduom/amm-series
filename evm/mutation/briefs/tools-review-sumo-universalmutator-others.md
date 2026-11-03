# Tool research: Review SuMo, universalmutator, others

Sent on 2026-11-02 to a research subagent.

## Brief

Read these pages and answer from them only, saying plainly where a page does not answer: https://github.com/MorenaBarboni/SuMo-SOlidity-MUtator , https://arxiv.org/pdf/2105.03626 , https://github.com/agroce/universalmutator , https://github.com/RareSkills/vertigo-rs , https://github.com/trailofbits/necessist , https://frameworks.securityalliance.org/security-testing/mutation-testing
For each of SuMo, universalmutator, vertigo-rs: (1) the mutation operators, listed with what each changes, especially any that change numeric literals, add or subtract constants, swap comparison operators, swap adjacent lines, change msg.sender, change function visibility or payable, change the order of require checks, or remove modifiers; (2) how to install it and what it depends on; (3) whether it supports Foundry projects, how it runs tests, and whether it works with invariant tests; (4) Solidity version limits, and whether it can handle 0.8.38; (5) date of the latest commit or release, and whether it looks maintained; (6) how many mutants it tends to produce, if stated.
For necessist: (7) what it does, whether it supports Foundry, how it is installed, how long it takes, the latest release date, and whether it would flag test statements that can be removed without any test failing.
Also read the Security Alliance page and give its recommendation between these tools, if it gives one.
