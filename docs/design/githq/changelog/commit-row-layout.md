# Commit row layout

A commit row cuts its headline and its author's name even where the window has room: the author box is a fixed
110 px, so "Michał Kędrzyński" or "dependabot[bot]" is always cut. This round proposes a one-line row whose author box
takes its name's natural width, and two two-line rows that give the headline a line to itself, for the owner to pick
from. Round 2: the owner picked the two-line row with the metadata below, and it became `Commit row`. Base:
`1d45cfcd`.

## Round 1 · agent brief

Asked (`.context/commit-row-brief.md`): Variant A, today's row with the author at natural width (recommended); Variant
B, two lines with the metadata below; Variant C, two lines with the refs on the headline line; each as the full commits
screen with a wide list and the same list beside a commit's details; B's selected and hovered row. Changed: three new
row components, three new pane components and one amber `Variants` frame with seven screens. `Commit row` (`EMjBX`)
and every existing screen are unchanged.

Round 2 settled the question: the owner picked B, so the A and C nodes and the two-line components are gone and their
entries are removed; what survives of round 1 is below, as it stands after round 2.

- [ ] Components · Commits › Panes (`X13Fc6`): new `Commit graph / Few branches · two lines` (`ai0OO`), after
  `Commit graph / Few branches`: the same 24 commits and graph drawing with longer data. Rafał Hoffmann → Michał
  Kędrzyński, Sofia Rossi → Ola Wiśniewska-Kowalczyk, dependabot → dependabot[bot] (c18 now `chore(deps): bump
  @nuxt/kit from 3.15.1 to 3.16.0`); c03 carries `main`, `staging`, `v4.3.0` and `+3`; c13 `release/4.2`, `v4.2.1` and
  `+2`; c05's pull request and CI not known yet; c07 and c15 have longer headlines; every commit has a short sha (c02
  `e81c4a2`, as in `Commit details`). Renamed and re-drawn in round 2.
- [ ] `CH64 · Variant B · Two lines, metadata below` (`f4XIii`): copy of CH3 (sidebar, ref list, a 924 px list) with
  the two-line pane; nothing cut. Moved and renamed in round 2.
- [ ] `CH65 · Variant B · Two lines, metadata below, details open` (`GNVkW`): copy of CH18 (a 484 px list beside
  `Commit details`), c02 selected; the sha and its separator off below 640 px; 6 of 24 headlines cut. Moved and renamed
  in round 2.
- [ ] `CH66 · Variant B · The selected and hovered row` (`l1o6L`): two actual-size crops (720 px wide, 484 px with
  details open) of the two-line pane, c02 selected (`$sel`, accent outline at 30 %, `$accent` ring) and c04 hovered
  (`$bg-3`, ring `#656C7680`), as CH54. Moved and renamed in round 2.

Rows per 900 px of list: 28 at 32 px (A, today), 17 at 52 px (B, C).

## Round 2 · agent brief

Asked (`.context/commit-row-brief-2.md`): the owner picked Variant B. Make `Commit row` the two-line row everywhere,
re-draw every graph for the 52 px pitch row-locally, update the ghost row, settle the variants. Changed: `Commit row`
(`EMjBX`) is now the two-line row, so every commit screen shows two-line rows; every graph drawing is re-spaced; CH64–CH66
are ordinary screens in a new group; A, C, the `Variants` frame and the extra row components and panes are deleted.

The graphs follow what the code draws, row-local: in each row the dot's centre is 16 px from the row's top; a lane
passing straight through runs the full 52 px; a curve into the dot comes from the row's top edge over the 16 px above
it; a curve out of the dot leaves for the row's bottom edge over the 36 px below. Each path was mapped from its 32 px
original that way: the upper 16 px of a row kept, the lower 16 px stretched to 36, the cut around a hollow dot or a
CI ring kept at its radius. Round 1's `(y − 16) × 52/32 + 16` mapping (a 26/26 split) is replaced. `CommitGraphCell`
still puts the dot in the middle of the row (`middle = height / 2`); building this moves it to 16 px.

- [ ] `Commit row` (`EMjBX`): the two-line row, the layout `Commit row · two lines` had in round 1, keeping its id and
  the ids of everything inside. Row 32 → 52 px; `Surface` (`kFDB3`) 28 → 48 px, `alignItems` center → start; `Graph`
  (`tze97`) 28 → 48 px (the `Dot ring`, `gxMLU`, stays at y 6, so the dot is 16 px from the row's top). New vertical
  `Lines` (`vJGwe`, gap 3, padding `[5, 0, 4, 0]`). `Line 1` (`uc3T3`, 18 px, gap 6): `Message` (`RxUsy`, 13 → 14 px),
  `PR` (`RHE4I`), `CI` (`z72k2`). `Line 2` (`wD1dV`, 18 px, gap 6, 12 px): new `Refs` (`o8PfMP`, off by default,
  `fit_content(0)`, gap 4) holding the two worktrees and four refs that were before the headline; new `Author box`
  (`jVwNj`, gap 5) with `Author` (`K7XiMI`, 16 → 14 px, initials 7 → 6 px) and `Author name` (`IebtI`, a fixed 110 × 16
  box → natural width); new `Separator 1` (`u8x38c`); `Date cell` (`R67Crc`); new `Separator 2` (`taOi1`); new `Sha`
  (`FV92i`, `$mono` 11.5 px `$fg-dim`). `Headline` (`eAF8P`) and `Message cell` (`QL19z`) deleted.
- [ ] Every `Commit row` instance (the ten `Commit graph / …` panes, CH61's twelve rows): its `Sha` set (the
  few-branches and not-known-yet panes use `ai0OO`'s shas, the rest made up), `Refs` turned on in every row that shows
  a ref or a worktree.
- [ ] Narrow lists (CH29 `KZksk`, CH42 `YvExd`): below 640 px the sha and `Separator 2` go off instead of the author's
  name, as CH65 drew it.
- [ ] Headlines cut with an ellipsis, re-cut for the 14 px headline on a line of its own (the one-line cuts were
  for 13 px beside the author): CH16 (`m5T0NV`), CH18 (`CSIbx`), CH20 (`t5ylMf`), CH27 (`v0ZFU`), CH28 (`pmqyb`),
  CH41 (`UoiVM`): of the 8 headlines each cut before, 6 are still cut, further along, and 2 are whole; CH42
  (`YvExd`): 6 of its 14 still cut; CH29 (`KZksk`): 17 rows cut, 9 of them newly (they ran past the list before); CH65 (`zGkwi`) and CH66 (`X7aHi`, `aw2gL`): c01, c03, c07, c15, c17, c20 re-cut so
  they end before the list's edge.
- [ ] `Commit graph / …` panes' `Graph drawing` and `Graph divider`, row-local for the 52 px pitch, heights rows × 52:
  Few branches (`g6kfP`, `k0DqM`, 1248), Many branches · capped (`r6W7Ds`, `oqexU`, 1352), Many branches · every lane
  (`T0aoP`, `CbSze`, 1352), First page, default branch only (`YAAi9`, `ktort`, 884), Few branches · not known yet
  (`xOlz1`, `h80Doh`, 1248), One branch (`a5Qvh`, `Plsg9`, 624), The beginning (`o9mwGt`, `GNkRm`, 676), After a
  force-push (`MRr2O`, `GL1vI`, 1248), Local clone (`lgXeK`, `QzbPp`, 1404), Many branches · three lanes (`jaTAI`,
  `NEIyY`, 1352). The panes grow with their rows; the screens holding them are fixed 900 px and clip.
- [ ] `Commit graph / Few branches · two lines` (`ai0OO`) → `Commit graph / Few branches · long names and refs`: its rows
  are `Commit row` instances (new ids) with the same data; its drawing (`o6vaO`) re-spaced row-locally (now identical
  to the few-branches drawing).
- [ ] CH61 (`scrBz`): `Graph drawing` (`fziJ0`) row-local, 384 → 624 px; `Rows at 3×` (`ikaW4`) 1152 → 1872 px: rows
  96 → 156 px, the paths, stripes, surfaces (84 → 144 px) and rings moved with their rows, headlines 36 → 42 px on
  line 1 (only the headline is drawn beside the graph at 3×, as before).
- [ ] CH54 (`bEoEQ`): `Rows` crop (`YwgvB`) 224 → 260 px, five whole rows; `Rows at 3×` (`JR2zo`) 480 → 780 px, as
  CH61's.
- [ ] CH59 (`Q8tHB`): `Rows` crop (`aveQn`) 224 → 260 px; note `Db0ad`: "a graph row's surface 28 px" → "a graph row's
  first line 18 px".
- [ ] CH12 (`omsq4`): 450 → 468 px, nine whole rows (the running c01 and the failing c02 and c09 still in view);
  caption `woMK8`: "only the author and the age are aligned at the right edge" → the author, the age and the sha
  follow on line 2.
- [ ] Group 2's note (`ShEcf`): the row reads in two lines (was: left to right, the author and age at the right edge).
- [ ] `Empty / Ghost commit row` (`J0Vrj`): 32 → 52 px, `alignItems` start; `Graph` (`KkPtK`) and `Lane` (`Xz9fw`)
  52 px; `Commit` dot (`zueUx`) y 12 → 11.5 (centre at 16); new `Lines` (`MQxfX`, gap 3, padding `[7, 0, 6, 0]`),
  `Line 1` (`brtra`) with the message bar, `Line 2` (`i78bPJ`, gap 6) with the avatar (16 → 14 px), the name bar and
  the age bar. Instances keep their bar widths.
- [ ] `Empty / Still arriving · commits` (`Rp1Rx`): 25 → 16 ghost rows (the 9 that fell below 826 px deleted), the
  fade re-spread from 1 to 0.15 over the 16.
- [ ] App · Commits (`DtWFt`): new `Group header` (`SNJZK`) `7 · The commit row` and `Row of screens · The commit row`
  (`hfP4x`) at the end, holding CH64, CH65, CH66 moved out of the `Variants` frame.
- [ ] CH64 (`f4XIii`, `GvNxT`, caption `Y7oi7t`), CH65 (`GNVkW`, `buOm9`, `Bi6ir`), CH66 (`l1o6L`, `B1gzq5`, `qqRdG`):
  `Variant B · ` dropped from slot, screen and caption titles. Their pane instances replaced (`SQbL0`, `zGkwi`,
  `X7aHi`, `aw2gL`) to point at the new rows. Captions: CH64 (`TIN9a`) loses "against 28 today, 39% fewer" and says how
  the lanes run; CH65 (`EznyR`) loses "against 11 in CH63"; CH66 (`JjiNN`) loses "as the one-line row's 28 in 32".
- [ ] Deleted: `Variants · How a commit row reads` (`k0xLo4`) with CH62 (`n8u560`), CH63 (`e8JrOf`), CH67 (`i1Ys6o`)
  and CH68 (`HYZiO`); `Commit row · natural author` (`hTrFq`), `Commit row · two lines` (`NWhK3`), `Commit row · two
  lines, refs first` (`cQAjm`); `Commit graph / Few branches · natural author` (`h9SXzk`), `Commit graph / Few branches
  · two lines, refs first` (`ekFyW`). The codes CH62, CH63, CH67, CH68 are not reused.
