# kestrel-fast-csv

[![Read broken CSV files faster](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![Rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/mevlanayalcin/kestrel-fast-csv/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![Reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/mevlanayalcin/kestrel-fast-csv/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

An entry for [Read broken CSV files faster](https://make.fun/bounty/csv-reader-speed-01-run-20261121): a dependency-free ES module drop-in for make.fun's `csv-reader 1.0.0` powered by an inline `no_std` Rust WebAssembly `simd128` (`v128`) streaming JSON-to-JSON CSV transducer.

- `solve.js` exports `run(input)` (`csv-reader 1.0.0`'s exact `{columns, rows, errors}`), `answerCases(read, write)`, and `main()`.
- `main.ts` is a single 36-byte line importing and invoking `main()` from `solve.js` (`node main.ts` reads `/input/cases.json` and writes `/output/answers.json`, with `MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR` supported outside a container).
- `wasm_src/` holds the clean `no_std` Rust source (`wasm_src/src/lib.rs`, `wasm_src/Cargo.toml`) compiled with `RUSTFLAGS="-C target-feature=+simd128 -C opt-level=z -C lto=fat -C codegen-units=1 -C panic=abort -C link-arg=-zstack-size=4096" cargo build --target wasm32-unknown-unknown --release` (`5,813` bytes, embedded as base64 in `solve.js`).

## Architecture

1. **Direct Escaped-Byte JSON-to-JSON Transduction**: Reads each case's `"text"` literal directly as raw UTF-8 JSON bytes in WebAssembly linear memory and writes each answer directly as JSON bytes — zero JS string decoding, zero `JSON.parse` / `JSON.stringify` on the hot path.
2. **`v128` SIMD Multi-Comma Draining (`wasm32` `simd128`)**:
   - Scans 16 bytes at a time via `v128_load`, `v128_store`, `u8x16_eq`, `v128_or`, and `u8x16_bitmask`.
   - Drains multiple commas within a 16-byte vector (`m_spec == 0`) with `popcnt` field counting and zero per-comma width-check branches (cutting `long_row` extras only in the cold record-end helper).
   - Dedicated fast path for quoted fields (`\"`, `\"\"`, `\",`, embedded `\r\n`/`\r`/`\n`).
   - Hoisted SIMD constants (`read_volatile`) and register-lean hot loop (`5` hot GP locals + `3` XMM locals) so V8 Liftoff compiles the `5.8 KB` module lazily in `< 0.5 ms` and executes at full native SSE/AVX throughput without TurboFan compilation overhead.
3. **Cache-Hot 1 MiB Streaming Windows**: Streams `/input/cases.json` and `/output/answers.json` directly through WASM linear memory in 1 MiB windows (~2 MiB resident working set, minimal page faults and syscalls) with dynamic buffer growth for arbitrarily large fields, wide rows, or high error counts, plus automatic `JSON.parse` + `run()` fallback for rare structural `\u00XX` JSON escapes.

## License

MIT
