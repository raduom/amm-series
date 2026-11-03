# Mutation testing the pool

Everything behind the mutation testing of `src/ConstantProductPool.sol`: the bugs, the tool mutants, the briefs the reviewers worked from, the scripts and every result. [LOG.md](LOG.md) tells the story and gives the conclusions. This file says where each part is and how to run it again.

## What is here

| Path | What it holds |
|---|---|
| [LOG.md](LOG.md) | The six review rounds, the Gambit experiment, the Foundry 1.8.7 recheck, the tool comparison and closing the gaps |
| [equivalent.md](equivalent.md) | The 35 equivalent tool mutants, each with the reason it changes nothing, and the four real gaps beside them |
| [bugs/](bugs) | Every bug scored, as a diff against the contract |
| [suites/](suites) | The one suite that is in no commit, as a diff |
| [scripts/](scripts) | The scripts that build the suites and score the bugs, runnable from here |
| [results/](results) | Every result the log quotes |
| [reviewers/round6/](reviewers/round6) | Round 6 as the reviewers left it: each mutant they made, caught or not, and their own scripts |
| [briefs/](briefs) | The briefs each review round and the tool research were sent |
| [history/](history) | The scripts as they ran, with the paths of the machine they ran on |

### The bugs

Each bug is a unified diff against the contract as of commit `b2b1365`, the last one to change it. [scripts/contract.sh](scripts/contract.sh) prints that contract.

| Folder | Count | Where they came from |
|---|---|---|
| [bugs/earlier](bugs/earlier) | 39 | The scripted bugs from rounds 1 and 2 |
| [bugs/gambit](bugs/gambit) | 83 | Gambit's mutants, for the Gambit experiment |
| [bugs/rounds345](bugs/rounds345) | 82 | Rounds 3 to 5, rebuilt from the reviewers' reports with duplicates removed. `r3-` and `r4-` come from [history/rounds3and4.py](history/rounds3and4.py), `r5-` from [history/round5.py](history/round5.py) |
| [bugs/round6](bugs/round6) | 29 | Round 6's survivors, without two duplicates |
| [bugs/tools](bugs/tools) | 352 | Every distinct mutant from the five tools, named by the first 12 hex digits of its bytecode hash |

The 233 hand-made bugs are named `<folder>-<file>` in the results, such as `round6-astra-init-cross-balance`. [bugs/tools.json](bugs/tools.json) gives, for each tool mutant, the name each tool that made it gave it.

Round 6 left 31 survivors in [reviewers/round6/collected](reviewers/round6/collected). Two of them build the same contract as another: `opus-empty-judged-by-sum` is `fable-empty-by-sum`, and `sol-initialize-max-approval` is `opus-init-unlimited-skips-payment`.

### The suites

[scripts/suites.py](scripts/suites.py) rebuilds every suite the results were scored with, from git:

| Suite | Tests | Lines | From |
|---|---|---|---|
| `base` | 30 | 459 | Commit `d1dbe9f`, the first suite, where the tool comparison started |
| `current` | 71 | 1193 | Commit `f814f4f`, the suite before closing the gaps |
| `step1` | | 1243 | `current` with the tests that closed the gaps, before the overlap pass, from [suites/step1.diff](suites/step1.diff) |
| `final` | 65 | 1189 | Commit `696973f`, after the overlap pass |
| `gambit`, `slither`, `sumo`, `forge`, `umut`, `all` | | 464 to 533 | `base` with only the tests that tool's survivors asked for, A to I in `suites.py` |

Test counts are the log's, with each invariant counted once per pool.

## Running it again

You need Foundry 1.8.7, solc 0.8.38 where forge installs it (`~/.local/share/svm/0.8.38/solc-0.8.38`, or set `SOLC`), GNU `patch`, Python 3 and the submodules in `evm/lib`. Run everything from this folder. The scripts write to `WORK`, `/tmp/amm-mutation` by default, and take forge from `PATH` or from `FORGE`.

```sh
python3 scripts/suites.py /tmp/amm-mutation/suites
scripts/list.sh all > /tmp/amm-mutation/all.list
scripts/score.sh final-all /tmp/amm-mutation/suites/final /tmp/amm-mutation/all.list
```

[scripts/list.sh](scripts/list.sh) takes the sets `earlier`, `gambit`, `rounds345`, `round6`, `hand`, `tools`, `tool:<name>` and `all`. To score only some bugs, filter its output, for example to the tool mutants that survived the 30 tests:

```sh
scripts/list.sh tools | grep -wFf <(awk '$2 != "caught" {print $1}' results/tools/base-union.txt)
```

[scripts/score.sh](scripts/score.sh) gives each bug its own copy, the suite's tests, a clean cache and seeds 1 and 7, with `FOUNDRY_INVARIANT_RUNS=25 FOUNDRY_INVARIANT_DEPTH=100 FOUNDRY_INVARIANT_SHRINK_RUN_LIMIT=0`. It runs two bugs at once, writes `<name> caught|survived s1:<failed> s7:<failed>` lines, and resumes where it stopped. On a laptop it stops starting bugs once the battery falls 3 Wh below where it began. [scripts/matrix.sh](scripts/matrix.sh) is the same, but records which tests failed, and [scripts/analyze.py](scripts/analyze.py) reads that to find tests that catch nothing alone, or to check a plan of merges and removals.

To compare a new run with a stored one, compare the first two columns: the failure counts can differ under another forge version.

```sh
diff <(cut -d' ' -f1,2 results/tools/current-union.txt) <(cut -d' ' -f1,2 /tmp/amm-mutation/results/current-union.txt)
```

The full set of 585 bugs is about 1170 forge runs.

### Making the tool mutants again

| Tool | Version |
|---|---|
| Gambit | 0.2.1, `cargo install --git https://github.com/Certora/gambit --rev 072ff4c` |
| `slither-mutate` | slither-analyzer 0.11.6, from pip |
| SuMo | `@morenabarboni/sumo` 3.2.1, from npm |
| universalmutator | 1.14.1, from pip |
| `forge test --mutate` | Foundry 1.8.7 |

Run each in a scratch copy of `evm` holding `src`, `test`, `foundry.toml` and a `lib` link. With `SOLC` as above:

- **Gambit:** `gambit mutate --filename src/ConstantProductPool.sol --solc $SOLC --solc_remappings '@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/' --sourceroot . -o out`. Adding every operator with `--mutations` gives the same 83.
- **`slither-mutate`:** it edits the contract in place and keeps only the mutants the tests miss, so [history/slither-capture.sh](history/slither-capture.sh) stands in for the tests: it passes on the unchanged contract and saves every changed copy. Put the contract's sha256 in `orig.sha`, then run `slither-mutate . --test-cmd ./capture.sh --test-dir test --contract-names ConstantProductPool --comprehensive --timeout 20 --compile-force-framework foundry -v`.
- **SuMo:** it only runs inside an npm project. Add a `package.json` of `{"name":"amm-sumo"}` and a `package-lock.json` of `{"name":"amm-sumo","lockfileVersion":3,"packages":{}}`, link `node_modules` to where SuMo is installed, add [history/sumo-config.js](history/sumo-config.js), run `forge build`, then `APP_ROOT_PATH=$PWD node_modules/.bin/sumo mutate` with forge on `PATH`. The mutants land in `sumo/results/mutants`.
- **universalmutator:** `mutate ConstantProductPool.sol solidity --noCheck --swap --mutantDir out`, in a folder holding only the contract.
- **`forge test --mutate`:** it keeps no mutant files, and it skips related mutants once one survives. So list them in a copy whose only test is [history/forge-list.t.sol](history/forge-list.t.sol), which checks the pool's creation code against the unchanged contract's hash. That hash depends on the build settings, so take it from the copy first. Every mutant then fails it, none is skipped, and the run takes seconds: `forge test --mutate src/ConstantProductPool.sol --mutation-jobs 2 > list.log`. Then `python3 scripts/forge-mutants.py list.log out` writes each mutant back from its line and edit.

Then [scripts/filter.py](scripts/filter.py) compiles each tool's mutants and keeps those that compile to new bytecode, and [scripts/union.py](scripts/union.py) merges them across tools into `bugs/tools` and `tools.json`:

```sh
python3 scripts/filter.py gambit /tmp/amm-mutation/kept out/mutants/*/src/ConstantProductPool.sol
# ... the same for slither, sumo, umut and forge
python3 scripts/union.py /tmp/amm-mutation/kept /tmp/amm-mutation/bugs
```

[scripts/report.py](scripts/report.py) prints each tool's outcomes from a results file of tool mutants, and the lines each one not caught changes.

## The results

All under [results/](results). Each line names a bug and its outcome.

| File | Suite | Bugs | Log section |
|---|---|---|---|
| `tools/base-union.txt` | `base` | The 352 tool mutants | Tool comparison |
| `tools/<tool>-survivors.txt` | `<tool>` | The 55 tool mutants `base` did not catch | Tool comparison |
| `tools/<tool>-corpus.txt` | `<tool>` | The 233 hand-made bugs | Tool comparison |
| `tools/current-union.txt`, `tools/current-corpus.txt` | `current` | The 352, and the 233 | Tool comparison |
| `tools/step1-union.txt`, `tools/step1-corpus.txt` | `step1` | The 46 and the 30 that `current` did not catch | Closing the gaps |
| `tools/matrix-step1.txt`, `tools/matrix-step2.txt` | `step1`, `final` | All 585, with each failing test | Closing the gaps |
| `foundry-1.8.7/rounds1and2.txt` | `current` | The 39 scripted bugs, from [history/rounds1and2.py](history/rounds1and2.py) | Foundry 1.8.7 |
| `foundry-1.8.7/mutants-187.txt` | `current` | Gambit's 83, and the unchanged contract as `control` | Foundry 1.8.7 |
| `foundry-1.8.7/hand-187.txt` | `current` | Rounds 3 to 5 | Foundry 1.8.7 |
| `foundry-1.8.7/kinds.txt`, `foundry-1.8.7/hk.txt` | `current` | Gambit's 83 and rounds 3 to 5: per bug and seed, the failures in all, in `setUp`, in invariants and in unit tests | Foundry 1.8.7 |
| `foundry-1.8.7/*.log`, `before.txt`, `build-171.txt` | `current` | The suite on the clean contract, before and after the upgrade, and the pinned files | Foundry 1.8.7 |
| `gambit-experiment/results.txt` | `base` | Gambit's 83, under Foundry 1.7.1 | Gambit experiment |
| `hand/current71.txt`, `hand/gambit31.txt` | `current`, `gambit` | Rounds 3 to 5, under Foundry 1.7.1 | Gambit experiment |
| `hand/recheck-gambit31.txt` | `gambit` | The 77 of those `gambit` did not catch, again | Gambit experiment |
| `hand/earlier44-gambit31.txt` | `gambit` | The scripted bugs from rounds 1 and 2 | Gambit experiment |
| `hand/r6-current71.txt`, `hand/r6-gambit31.txt` | `current`, `gambit` | Round 6 | Round 6, Gambit experiment |
| `tool-runs/` | | What each tool printed or wrote when it made its mutants | Tool comparison |

The results under `hand/` and `gambit-experiment/` came from [history/score-corpus.sh](history/score-corpus.sh) and [history/gambit-score.sh](history/gambit-score.sh). Those stopped at the first seed a bug survived, so their lines carry no failure counts.

## Reviewers' material

[reviewers/round6/](reviewers/round6) has one folder per reviewer. Each `.diff` is one mutant, against the same contract as the bugs, and `outcomes.txt` gives the last test summary of each mutant's runs. Opus's `Detect.t.sol` holds the tests it wrote to show that each of its survivors behaves differently from the correct pool, which `detect.sh` ran against each one, and Fable's `tools/` holds its runner and batches. Only round 6 kept these. For rounds 1 to 5 the reviewers' mutants are rebuilt in [bugs/](bugs), and their full reports are in the T3 Code threads the [briefs](briefs) went to.
