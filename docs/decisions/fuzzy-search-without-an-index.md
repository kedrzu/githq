# Fuzzy search with uFuzzy, on the main thread, without an index

## Status

Accepted (2026-11-01).

## Context

Lists filtered by typed text followed three rules: a home-made scorer in the command menu, a contiguous match for
item titles there, a substring in pickers and on the tracking screens. None took a typo, and few took words in
another order. The owner asked for one fuzzy rule on every such list, and for the menu to show what matched. The
local copy keeps every item in memory, possibly tens of thousands of them, and "a slow screen is a bug".

Enter typed right after the last letter picks the best match, from the rows of that moment
(`packages/app/components/FilterList.vue`), so results have to be computed synchronously.

**Measured 2026-11-01** on the owner's Mac, in Node 23 (V8), over real titles of vuejs/core, vercel/next.js and
microsoft/vscode recombined. Size is the whole module, minified and gzipped:

|Library|Size|Build, 50k|Query, 50k (median / p95)|Takes a typo|
|-|-|-|-|-|
|uFuzzy 1.0.19, one-typo mode|4.3 KB|none|2.8 / 4.3 ms|yes, `reactivty` run and found|
|fuzzysort 4.0.2|8.6 KB|34 ms|4.0 / 9.4 ms|no, `reactivty` run: 0 hits|
|MiniSearch 7.2.0|6.0 KB|159 ms|1.8 / 6.3 ms|by its docs, hits not checked; matches tokens|
|Fuse.js 7.5.0|9.7 KB|7 ms|97 / 228 ms|by its docs, hits not checked|

fzf was not measured: npm shows its last release in 2023. A WASM matcher such as nucleo was not looked for to
the end: there was nothing left for it to speed up.

## Options Considered

- **uFuzzy, main thread.** A regex over an array of strings, so nothing to build and nothing to update
  incrementally. Takes a typo, any order of up to 5 words, and returns ranges. Trade-off: no letters across words
  (`ipg`), ranking every hit is slow, Latin only without its unicode mode.
- **fuzzysort.** Scattered letters are its strength, but it takes no typo, and it needs each text prepared.
- **Fuse.js.** The known name, about 30 times slower on the same data.
- **MiniSearch or FlexSearch.** A real index to keep current, for whole-text search over tokens, which is not what
  a filter over titles asks for.
- **A worker or WASM.** Keeps the main thread free at any size, but results arrive later, which breaks Enter after
  typing, and adds the cost of moving the strings across. It solves a problem the measurements don't show.

## Decision

uFuzzy, on the main thread, in one unit `packages/app/utils/findMatches.ts` that every list uses. What it adds:

- Scores stay on the scale the menu ordered groups by: whole 100, start 80, word starts 60, part 40, a typo at a
  word's start 50, elsewhere 30.
- Letters in order stay a fallback below those (1–20), only on short lists of names: not item titles, whose rows
  they flood, and not the tracking screens, where ⌘A would select what they catch.
- Texts are latinized once, per array of items or options. Hits are capped to the first 1000 before ranking.

Numbers on the final code, `bun packages/app/scripts/benchFindMatches.ts`, medians over 50k titles, ranges for every
hit: `e` 2.2 ms, `fi` 3.0 ms, `compilr` 8.5 ms, `reactivty` 14.3 ms, `slot fix` 5.2 ms, `a e i o u` 12.3 ms; on V8
`reactivty` takes about 6 ms. With 50k items and 50k options on a project page, the slowest query measured was
15.3 ms on Bun and 8.9 ms on Node.

## Consequences

Gained: one rule everywhere, typos and word order included, 4.3 KB, no state to keep current.

Accepted:

- A query with over 1000 hits ranks only the newest 1000, so one or two letters may miss an older better match. The
  menu shows 8 items.
- The first keystroke after items change readies them again: about 45 ms at 50k, growing with the items. Readying when the
  menu opens would move that cost, not remove it.
- Margins on Bun (JavaScriptCore, the engine family of the desktop app's WebKit) are thin at 50k: typo queries reach
  15 ms. If that grows, the fallback is the one in D17: keep closed items out of memory.
- Above 1000 options, direct options at the top of the command menu take no typo: they are items, which the menu
  already finds with a typo, and searching them twice cost the frame.
- `latinize` is a fixed list: `ø`, `æ`, `ß` and decomposed text are not folded. They still match as typed.
- Above 5 words a query still filters by all of them, without marks.
