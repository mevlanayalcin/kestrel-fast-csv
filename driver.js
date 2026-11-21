// kestrel-fast-csv: what main.ts runs. It reads every case from /input/cases.json (a JSON array of {id, input}),
// answers each one alone with solve.js and writes /output/answers.json: a JSON array of the answers, one per case and
// in the cases' order. MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand in for /input and /output outside a container.
// The steps are solve.js's main().

import { main } from './solve.js';

main();
