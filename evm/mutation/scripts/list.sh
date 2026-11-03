#!/bin/bash
# usage: list.sh <set>...   prints "name diff" lines for score.sh and matrix.sh
# Sets: earlier, gambit, rounds345, round6 (the hand-made bugs, named <set>-<bug>),
# hand (all four), tools (the 352 tool mutants, named by bytecode hash),
# tool:<gambit|slither|sumo|forge|umut> (the mutants that tool made), and all.
M=$(cd "$(dirname "$0")/.." && pwd)
hand() { for f in "$M"/bugs/$1/*.diff; do echo "$1-$(basename "$f" .diff) $f"; done; }
for s in "$@"; do
  case $s in
    earlier|gambit|rounds345|round6) hand $s ;;
    hand) for h in earlier gambit rounds345 round6; do hand $h; done ;;
    tools) for f in "$M"/bugs/tools/*.diff; do echo "$(basename "$f" .diff) $f"; done ;;
    tool:*) python3 -c 'import json,sys; [print(h) for h,v in sorted(json.load(open(sys.argv[1])).items()) if sys.argv[2] in v]' \
              "$M/bugs/tools.json" "${s#tool:}" | while read h; do echo "$h $M/bugs/tools/$h.diff"; done ;;
    all) "$0" hand tools ;;
    *) echo "unknown set: $s" >&2; exit 1 ;;
  esac
done
