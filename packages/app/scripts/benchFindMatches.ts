import { findMatches, prepareMatchTexts } from '../utils/findMatches.js';

// Times `findMatches()` as the item search calls it: 50,000 titles, the first 1,000 hits ranked, ranges for all of
// them. The budget is one frame, 16 ms, per keystroke. Run by hand from the repo root:
//
//     bun packages/app/scripts/benchFindMatches.ts
//
// and on V8, which is what a browser runs:
//
//     bun build packages/app/scripts/benchFindMatches.ts --target=node --outfile=/tmp/bench.mjs && node /tmp/bench.mjs

const ROWS = 50_000;
const HIT_LIMIT = 1000;
const RUNS = 25;

const QUERIES = [
    'e',
    'fi',
    'fix',
    'hyd',
    'hydrate',
    'compilr',
    'reactivty',
    'fix slot',
    'slot fix',
    'reactivty map',
    'zolty',
    'zzzzqq',
    '-',
    'fix slot map',
    'a e i o u',
    'a e i o u r',
];

const WORDS =
    'fix feat chore docs refactor compiler sfc compiler-sfc runtime vapor core reactivity shared slot hydrate hydration keep parse map empty range close before content dynamic argument named key whitespace srcset descriptors nested blocks styles add remove update Żółty status label issue project iteration milestone assignee review merge build test release cache sync'.split(
        ' ',
    );

let seed = 42;
const titles = Array.from({ length: ROWS }, (_, index) => {
    const words = Array.from({ length: 4 + random(8) }, () => WORDS[random(WORDS.length)]);
    return `${words.join(' ')} ${index}`;
});

const prepareStart = performance.now();
const prepared = prepareMatchTexts(titles, title => [title]);
console.log(`prepare ${ROWS} rows: ${(performance.now() - prepareStart).toFixed(1)} ms`);

for (const query of QUERIES) {
    const times: number[] = [];
    let matchCount = 0;
    for (let run = 0; run < RUNS; run++) {
        const start = performance.now();
        matchCount = findMatches(query, prepared, { hitLimit: HIT_LIMIT }).length;
        times.push(performance.now() - start);
    }

    const median = times.toSorted((a, b) => a - b)[Math.floor(RUNS / 2)] ?? 0;
    console.log(`${JSON.stringify(query).padEnd(36)} ${median.toFixed(1).padStart(6)} ms  ${matchCount} matches`);
}

/** Seeded, so every run times the same titles. */
function random(below: number) {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed % below;
}
