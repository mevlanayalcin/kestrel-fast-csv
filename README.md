# kestrel-fast-csv

[![Read broken CSV files faster](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![Rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/mevlanayalcin/kestrel-fast-csv/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![Reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/mevlanayalcin/kestrel-fast-csv/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

An entry for [Read broken CSV files faster](https://make.fun/bounty/csv-reader-speed-01-run-20261121): a dependency-free ES module drop-in for make.fun's `csv-reader 1.0.0` powered by a Lean-Start CJS driver and a `no_std` Rust WebAssembly `simd128` (`v128`) 32-byte streaming JSON-to-JSON CSV transducer.

- `solve.js` is a dependency-free ES module exporting `run(input)` (`csv-reader 1.0.0`'s exact `{columns, rows, errors}`) and `answerCases(read, write)`, backed by `w.wasm`.
- `main.ts` is an 18-byte Lean-Start CJS entrypoint (`require('./s.cjs')`) with `{}` `package.json` (zero ESM loader overhead, zero extra worker threads, minimal `amaro` TypeScript stripping, while Node 22 auto-detects `solve.js` as ESM).
- `s.cjs` (~3.4 KB) is the hot streaming CJS driver reading `w.wasm` directly in a single `openSync` + `readSync` + `closeSync` burst and lazily loading `fb.cjs` only on rare structural JSON escapes (`\u0022`, `\u002c`, `\u000a`, `\u000d`).
- `wasm_src/` holds the reproducible `no_std` Rust source (`wasm_src/src/lib.rs`, `wasm_src/Cargo.toml`) compiled with:
  ```bash
  RUSTFLAGS="-C target-feature=+simd128 -C opt-level=s -C lto=fat -C codegen-units=1 -C panic=abort -C link-arg=-zstack-size=4096 -C link-arg=--initial-memory=2097152" \
    cargo build --target wasm32-unknown-unknown --release
  ```
  producing `w.wasm` (`6,732` bytes, pre-sized 2 MiB initial linear memory for zero `mem.grow` on the hot path).

## Architecture

1. **Lean-Start CJS + Raw `w.wasm` + Lazy Fallback**:
   - Eliminates Node 22's ESM loader, module-graph resolution, failed `package.json` walks, and 4 extra libuv worker threads.
   - Configures `--no-incremental-marking --liftoff-only --wasm-lazy-compilation` so V8 Liftoff compiles `w.wasm` lazily in `< 0.5 ms` with zero TurboFan background compilation cost.
   - Keeps fallback code in `fb.cjs` so V8 never parses cold code during timed runs.
2. **Direct Escaped-Byte JSON-to-JSON Transduction**:
   - Reads `/input/cases.json` directly into WASM linear memory in L2-resident `256 KiB` streaming windows and writes `/output/answers.json` directly from WASM linear memory — zero JS string decoding, zero `JSON.parse` / `JSON.stringify` on the hot path.
3. **32-Byte `v128` SIMD Multi-Comma Transducer (`wasm32` `simd128`)**:
   - Scans 32 bytes per iteration (`2 × v128` -> `u32` bitmasks) for both unquoted and quoted fields, halving Liftoff loop-header stack spills and stack checks.
   - Unrolls up to 3 commas per 32-byte vector inline with branchless 32-byte copies and a `#[cold]` helper for dense `4+`-comma chunks, eliminating inner-loop Liftoff register spills (`-205M` L1 loads, `-3.8M` branch misses vs 16-byte loop).
   - Inlines the common-case record boundary (`"],[\"` on `\n`/`\r\n` when `nf > 0 && nf + 1 == width`) directly inside the SIMD loops.

## License

MIT
