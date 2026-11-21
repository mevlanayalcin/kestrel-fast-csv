# kestrel-fast-csv

[![Read broken CSV files faster](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![Rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/mevlanayalcin/kestrel-fast-csv/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![Reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/mevlanayalcin/kestrel-fast-csv/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

An entry for [Read broken CSV files faster](https://make.fun/bounty/csv-reader-speed-01-run-20261121): a drop-in
for make.fun's csv-reader 1.0.0 that returns the same `{columns, rows, errors}` for every input, in plain
JavaScript with no dependencies.

- `solve.js` exports `run(input)`, csv-reader's answer for one `{text, header}`; `answerCases(read, write)`, the same
  reader over a whole cases file; and `main()`, the driver.
- `main.ts` is one import of `driver.js`, which calls `main()`; `node main.ts` on Node 22 reads `/input/cases.json`
  and writes `/output/answers.json` (`MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` stand in outside a container).

## How it is fast

One byte-level reader does the work for both entry points. It reads a text as a JSON string literal and writes
each answer as JSON bytes, so `main()` never parses `cases.json` into strings or stringifies the answers: it reads
the file a 1 MiB window at a time, reads each case's text where it lies, and writes answers a window at a time.
Field bytes are copied as they stand (a JSON escape in the input is a valid escape in the output), eight bytes a
step, with the next comma, quote or backslash found by a SWAR zero-byte test and the first of the two words that
holds one picked without a branch. `run()` feeds the same reader `JSON.stringify(text)` and parses what it writes.

The reader holds only what most fields meet (commas, line breaks, quoted fields); stray CRs, junk after a closing
quote, a quote that never closes, rare escapes and ragged rows go to small functions it calls. It is a closure over
the one input window and output buffer every cases file is read through, and V8 optimises a function it has made only
one closure of for that closure's own variables: the views' maps and the window's place are constants in its code
rather than checks and loads at every step. Positions coming back from the small functions are truncated to int32,
so they stay untagged in registers.

V8 is tuned with `setFlagsFromString` (taken from the `v8` binding, as loading `node:v8` costs more than the flags
save) as the rules allow: incremental marking off, the reader warmed on small generator-shaped texts and compiled
once by TurboFan before the first case, with the passes it gains nothing from (inlining, loop peeling, escape
analysis, load and store elimination, jump threading) off, and nothing else tiered up mid-run. `main.ts` holds a
single import, as Node's type stripping of the entry costs CPU by the syntax it holds.

A cases file the walker does not take (JSON escapes `JSON.stringify` never writes, another layout) is answered the
plain way: `JSON.parse`, `run()` per case, `JSON.stringify`.

## License

MIT
