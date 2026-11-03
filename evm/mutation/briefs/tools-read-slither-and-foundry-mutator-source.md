# Tool research: Read Slither and Foundry mutator source

Sent on 2026-11-02 to a research subagent.

## Brief

Fetch these raw source files and report exactly what each mutator changes. Quote the operator tables or replacement lists. Say plainly if a file cannot be fetched.
Slither: https://raw.githubusercontent.com/crytic/slither/master/slither/tools/mutator/mutators/ROR.py , .../AOR.py , .../ASOR.py , .../LOR.py , .../BOR.py , .../UOR.py , .../LIR.py , .../MIA.py , .../MVIE.py , .../MVIV.py , .../MWA.py , .../SBR.py , .../FHR.py , .../RR.py , .../CR.py (all under the same directory), and .../all_mutators.py .
Also https://raw.githubusercontent.com/crytic/slither/master/slither/tools/mutator/__main__.py : how does it decide a mutant is caught, how are tests run, and is there any solc-select or compile step.
Foundry, under https://raw.githubusercontent.com/foundry-rs/foundry/master/crates/forge/src/mutation/mutators/ : binary_op_mutator.rs , unary_op_mutator.rs , assignment_mutator.rs , delete_expression_mutator.rs , require_mutator.rs , function_body_mutator.rs . If those paths fail, say so and try https://foundry-rs.github.io/foundry/forge/mutation/mutators/index.html . Report whether comparison operators are swapped.
For each slither mutator state whether it: changes a numeric literal or adds/subtracts a constant, swaps comparison operators (and which), swaps arithmetic operators, changes msg.sender, replaces a whole expression, removes a statement or a modifier, or moves code. One short line per mutator.
