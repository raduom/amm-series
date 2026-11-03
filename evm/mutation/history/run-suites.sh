#!/bin/bash
cd $HOME/.local/share/amm-series/tool-experiment
for s in gambit sumo forge umut all; do ./score.sh $s-survivors suites/$s survivors.list; done
./score.sh current-corpus current corpus.list
for s in gambit sumo forge umut all; do ./score.sh $s-corpus suites/$s corpus.list; done
