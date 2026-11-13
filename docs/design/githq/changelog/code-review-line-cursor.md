# Code review: the line cursor

A review's diff gets a visible line cursor, shared by the pointer and the keys, in place of the invisible reading line:
hovering a line, thread, header or gap puts the cursor there and makes its file current; ↓ ↑ move it, the screen
following at a third; the cursor's line carries a GitHub-style comment button whose tooltip names C. Settled by the
owner on 2026-11-13: D32, D42, D43, D44 in `docs/design/code-review/DECISIONS.md`. Base: `e0789572`.

## Round 1 · agent brief

Asked: the cursor on a line by the pointer and by the keys, the button's tooltip, unified, a thread, a collapsed
file's header and a gap under the cursor; CR29's keys. Changed: seven screens in a new group "Line cursor" in
App · Code review (`CEDLB`), new diff components, CR29 and CR106's caption.

- [ ] Diff parts › Line cursor (`RX2MT`): new `Diff / Comment button` (`eQbHY`, 16 × 16, radius 4, `$accent`, lucide
  `plus` in `#0D1117`), `· hover` (`dHp6a`, `#8B95F8`), `· tooltip` (`TO1uL`, "Comment on line 51" with Kbd `C`, as
  `Tooltip.vue`).
- [ ] Diff / Row · split (`qKwyX`): a hidden comment button per side (`c4bef6` left, `GsVhv` right); Diff / Row ·
  unified (`UtCoP`): one (`p3ZPrS`). Existing rows look the same.
- [ ] Nine `· cursor` row states, tint `#7B87F71A` over the row's own fill: split before `rP87V`, after `vvC0W`, changed
  before `khluf`, changed after `spHea`, added `QtlZd`, deleted `PFRP7`; unified `mfRpJ`, added `w3Ij5S`, deleted
  `BsWoF`.
- [ ] App · Code review (`CEDLB`): new group "Line cursor" (`dXShs`): CR120 (`gXrA2`) pointer on an added line's
  newer side; CR121 (`NaaUz`) keys on a context line's older side; CR122 (`v69GLL`) the button's tooltip; CR123
  (`uvDPa`) unified, a deleted line; CR124 (`br9W2`) a thread focused by ↓; CR125 (`RChlM`) a collapsed file's header
  current; CR126 (`QwPvc`) a gap focused.
- [ ] CR29 keys sheet: "Scroll by a line" (`bbP6m`) → "Move the cursor"; new rows "Switch side" ← → (`yYOBE`) and "A
  screen at a time" PgDn PgUp (`AT8q0`); caption (`V0GWA`) rewritten.
- [ ] CR106 caption (`ei6xC`): starts with "Replaced by CR120"; the screen unchanged.
- [ ] Layout: `CEDLB` grew 2164 px; the 25 top-level frames below it moved down as much.

Not drawn: four-digit numbers with the button (the design's number cell is a fixed 36 px; the code widens the column
as D43 says).
