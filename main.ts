// kestrel-fast-csv: the program the harness runs, `node /bot/main.ts` (node22). It reads every case from
// /input/cases.json (a JSON array of {id, input}), answers each one alone with solve.js and writes
// /output/answers.json: a JSON array of the answers, one per case and in the cases' order. MAKEFUN_INPUT_DIR and
// MAKEFUN_OUTPUT_DIR stand in for /input and /output outside a container.
//
// The steps are solve.js's main(): it reads the file a window at a time and answers each case where its text lies,
// with the byte-level reader run() is built on, and answers a file it does not read the plain way (JSON.parse, run()
// on each case's input, JSON.stringify). They live there, not here, because Node strips a .ts entry's types before it
// runs it at a cost that grows with the entry's code: this file is one statement.

(await import('./solve.js')).main();
