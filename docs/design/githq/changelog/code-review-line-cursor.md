# Code review: the line cursor

A review's diff gets a visible line cursor, shared by the pointer and the keys, in place of the invisible reading line:
hovering a line, thread, header or gap puts the cursor there and makes its file current; ↓ ↑ move it, the screen
following at a third; the cursor's line carries a GitHub-style comment button whose tooltip names C. Settled by the
owner on 2026-11-13: D32, D42, D43, D44 in `docs/design/code-review/DECISIONS.md`. Base: `e0789572`.

## Round 1 · agent brief

Asked: the cursor on a line by the pointer and by the keys, the button's tooltip, unified, a thread, a collapsed
file's header and a gap under the cursor; CR29's keys. Changed: seven screens in a new group "Line cursor" in
App · Code review (`CEDLB`), new diff components, CR29 and CR106's caption.

- [x] Diff parts › Line cursor (`RX2MT`): new `Diff / Comment button` (`eQbHY`, 16 × 16, radius 4, `$accent`, lucide
  `plus` in `#0D1117`), `· hover` (`dHp6a`, `#8B95F8`), `· tooltip` (`TO1uL`, "Comment on line 51" with Kbd `C`, as
  `Tooltip.vue`).
- [x] Diff / Row · split (`qKwyX`): a hidden comment button per side (`c4bef6` left, `GsVhv` right); Diff / Row ·
  unified (`UtCoP`): one (`p3ZPrS`). Existing rows look the same.
- [x] Nine `· cursor` row states, tint `#7B87F71A` over the row's own fill: split before `rP87V`, after `vvC0W`, changed
  before `khluf`, changed after `spHea`, added `QtlZd`, deleted `PFRP7`; unified `mfRpJ`, added `w3Ij5S`, deleted
  `BsWoF`.
- [x] App · Code review (`CEDLB`): new group "Line cursor" (`dXShs`): CR120 (`gXrA2`) pointer on an added line's
  newer side; CR121 (`NaaUz`) keys on a context line's older side; CR122 (`v69GLL`) the button's tooltip; CR123
  (`uvDPa`) unified, a deleted line; CR124 (`br9W2`) a thread focused by ↓; CR125 (`RChlM`) a collapsed file's header
  current; CR126 (`QwPvc`) a gap focused.
- [x] CR29 keys sheet: "Scroll by a line" (`bbP6m`) → "Move the cursor"; new rows "Switch side" ← → (`yYOBE`) and "A
  screen at a time" PgDn PgUp (`AT8q0`); caption (`V0GWA`) rewritten.
- [x] CR106 caption (`ei6xC`): starts with "Replaced by CR120"; the screen unchanged.
- [x] Layout: `CEDLB` grew 2164 px; the 25 top-level frames below it moved down as much.

Not drawn: four-digit numbers with the button (the design's number cell is a fixed 36 px; the code widens the column
as D43 says).

## Round 2 · agent brief

Asked (owner, 2026-11-13): the cursor is the whole row, both halves of a split row tinted together, no ← →; the
comment button on one side only, before the newer number, or the older one on a row with only an older line; D43 and
D44 rewritten to match. Changed: the split `· cursor` states became whole-row ones, CR121 moved to a deleted-only row,
CR29 lost "Switch side", the captions lost sides and ← →.

- [x] Diff / Row · split, cursor after (`vvC0W`) → `Diff / Row · split · cursor`: the left half tinted too
  (`TBDRE` `#7B87F71A`); the button stays before the right number.
- [x] Diff / Row · split, changed, cursor after (`spHea`) → `Diff / Row · split, changed · cursor`: the left half
  tinted over its red (`TBDRE` `#F851491A` + `#7B87F71A`).
- [x] Diff / Row · split, added, cursor (`QtlZd`) → `Diff / Row · split, added · cursor`: the empty left half tinted
  (`TBDRE` `#FFFFFF05` + `#7B87F71A`).
- [x] Diff / Row · split, deleted, cursor (`PFRP7`) → `Diff / Row · split, deleted · cursor`: the empty right half
  tinted (`bwyif` `#FFFFFF05` + `#7B87F71A`); the button stays before the left number.
- [x] Deleted `Diff / Row · split, cursor before` (`rP87V`) and `Diff / Row · split, changed, cursor before`
  (`khluf`): no screen uses them.
- [x] CR120 (`gXrA2`, `DeNEA`) and CR122 (`v69GLL`, `lOzMZ`): the row of line 51 tinted on both halves through
  `QtlZd`; CR120's caption (`D6li72`) rewritten for the whole row.
- [x] CR121: renamed "Cursor on the older side, by the keys" → "Cursor on a deleted line alone, by the keys" (slot
  `NaaUz`, screen `iwRlZ`, title `dfgqi`); caption (`jRez3`) rewritten. In its engine.ts block (`FtwCp`): line 49
  (`mIlUt`, a `rP87V` instance) → a plain row (`ahEUH`, `qKwyX`); new old line 50 `this.emit('idle')`, deleted alone,
  under the cursor (`v6Mvo`, `PFRP7`) after line 53; the old numbers below it 50, 51 → 51, 52 (`RzaOw`, `fHhGX`).
- [x] CR123 caption (`hHtPx`): no ← →; the deleted line takes the button by its old number, having no newer one.
- [x] CR125 caption (`FgV5e`): "crosses the reading line but is no longer current" → "is no longer current".
- [x] CR29: row "Switch side" ← → (`yYOBE`) deleted; caption (`V0GWA`) without ← →.
- [x] Group note "Line cursor" (`YdNfN`): a whole row in split, no ← →, the button's side.

Not changed: CR121's header and file list still say −18 for engine.ts, one deleted line short.

## Round 3 · agent brief

Asked (owner, 2026-11-13): the button between the number and the code, as on github.com, and on both halves of a
split cursor row, an empty half included, so the nearer one is a short reach; each comments on its half's line, or on
an empty half on the row's. D43 rewritten. Changed: the gutter after the number on every diff row, the button's place,
both buttons in the split cursor states, CR120–CR123 and their captions.

- [x] Diff / Row · split (`qKwyX`): number-to-code gap 12 → 24 px on both halves (`TBDRE`, `bwyif`), so the code starts
  at 60 px instead of 48 on every split screen; the hidden buttons `c4bef6`, `GsVhv` x 2 → 40, right after the number.
- [x] Diff / Row · unified (`UtCoP`): new `Gutter` column (`Qref2`, 24 px) between the numbers and the sign; button
  `p3ZPrS` x 2 → 84.
- [x] Placeholder rows follow, the bars starting where code does: split `JfZR9` (`vQ0zW`, `Rn4sj`) gap 12 → 24; unified
  `UMKkg` (`TE4Cj`) width 28 → 52.
- [x] Split cursor states `vvC0W`, `spHea`, `QtlZd`, `PFRP7`: both buttons shown (`c4bef6`, `GsVhv`); unified cursor
  states (`mfRpJ`, `w3Ij5S`, `BsWoF`) take the new place through the base.
- [x] CR120: both buttons through `QtlZd`, the left one on the empty left half at the same x; caption `D6li72`.
- [x] CR121: `v6Mvo` shows both buttons; engine.ts −18 → −19 in the header (`JQZqi/yHDS8`) and the file list
  (`kdg1R/emCdU/LBgg9/AyEQi`); caption `jRez3`.
- [x] CR122: hovered button `J4qHJ/pqdDU` x 2 → 40, pointer `uSfL7` on the right button, tooltip `ZGg6S` centred under
  it ("Comment on line 51", C); caption `BNUDg`.
- [x] CR123: one button after the number columns, before the sign; caption `hHtPx`.
- [x] Group note "Line cursor" (`YdNfN`) rewritten.

## Round 4 · implementation

Forced by: the axe contrast checks in `ReviewDiffRow.stories.ts` (D30). The cursor's tint `#7B87F71A` laid over a
deleted line's red fill puts the red line number at 4.48:1; built instead as the window's selection colour
(`$color-sel`, the accent at 10%) under the row's own green or red fill, 4.51:1, the same look. A commented line under
the cursor keeps its commented tint alone (both stacked would put the accent number at about 4.05:1). The design file is
unchanged: the drawn colours are the ones on screen.

- [x] Code only: `DiffRowSplit` / `DiffRowUnified` cursor tint under the row fill; the commented tint wins over it.

## Round 5 · merge of `main`

Forced by: `main` added the group "The conversation as cards" (`TT4mn`) to `CEDLB` and moved the 25 frames below it by
2270 px, while this branch had moved them by 2164 px (25 `y` conflicts). `CEDLB`'s auto layout keeps both groups apart,
"Line cursor" (`dXShs`) last; the frames below moved as rows so they keep 1200 px under `CEDLB`'s new bottom (59350).

- [x] 25 top-level frames below `CEDLB` (`D27jC` … `I5wWZ`): `y` +2310 from this branch's values, rows kept whole.
