# Commit row layout

A commit row cuts its headline and its author's name even where the window has room: the author box is a fixed
110 px, so "Michał Kędrzyński" or "dependabot[bot]" is always cut. This round proposes a one-line row whose author box
takes its name's natural width, and two two-line rows that give the headline a line to itself, for the owner to pick
from. Base: `1d45cfcd`.

## Round 1 · agent brief

Asked (`.context/commit-row-brief.md`): Variant A, today's row with the author at natural width (recommended); Variant
B, two lines with the metadata below; Variant C, two lines with the refs on the headline line; each as the full commits
screen with a wide list and the same list beside a commit's details; B's selected and hovered row. Changed: three new
row components, three new pane components and one amber `Variants` frame with seven screens. `Commit row` (`EMjBX`)
and every existing screen are unchanged.

- [ ] Components · Commits (`z0Je6`): new `Commit row · natural author` (`hTrFq`) right after `Commit row`: a copy of
  `Commit row` whose `Author name` is `auto` width instead of a fixed 110 × 16 box. Everything else as `Commit row`.
- [ ] Components · Commits (`z0Je6`): new `Commit row · two lines` (`NWhK3`): 52 px row, padding `[0, 8, 0, 4]`; a
  48 px `Surface` (radius 6, gap 8, right padding 12) holding the 64 × 48 `Graph` frame with the same `Dot ring`
  (16 px at x 2, y 6) and a vertical `Lines` frame (gap 3, padding `[5, 0, 4, 0]`). `Line 1` (18 px, gap 6): `Message`
  at 14 px `$fg`, then `PR` (`Commit / PR chip`, `Commit / Not known yet`), then `CI` (icon or not-known bar). `Line 2`
  (18 px, gap 6, 12 px): `Refs` (two `Commit / Worktree`, `Commit / Ref · default`, `· branch`, `· tag`, `· more`;
  the frame itself off by default so a row without refs starts flush), `Author box` (14 px `Avatar`, name in `$fg-2`),
  `·`, `Date` in `$fg-dim`, `·`, `Sha` in `$mono` 11.5 px `$fg-dim`. The dot's centre is 16 px from the row's top, as
  in the one-line row.
- [ ] Components · Commits (`z0Je6`): new `Commit row · two lines, refs first` (`cQAjm`): as `Commit row · two lines`,
  with `Refs` at the start of `Line 1` and `CI` at the end of `Line 2` (after the sha).
- [ ] Components · Commits › Panes (`X13Fc6`): new `Commit graph / Few branches · natural author` (`h9SXzk`), after
  `Commit graph / Few branches`: the same 24 commits and graph drawing, rows of `Commit row · natural author`. Data
  changes against the few-branches graph: Rafał Hoffmann → Michał Kędrzyński, Sofia Rossi → Ola Wiśniewska-Kowalczyk,
  dependabot → dependabot[bot] (c18 now `chore(deps): bump @nuxt/kit from 3.15.1 to 3.16.0`); c03 carries `main`,
  `staging`, `v4.3.0` and `+3`; c13 `release/4.2`, `v4.2.1` and `+2`; c05's pull request and CI not known yet; c07
  and c15 have longer headlines; every commit has a short sha (c02 `e81c4a2`, as in `Commit details`).
- [ ] Components · Commits › Panes (`X13Fc6`): new `Commit graph / Few branches · two lines` (`ai0OO`) and
  `Commit graph / Few branches · two lines, refs first` (`ekFyW`): the same data in rows of the two-line components,
  1248 px tall; the graph drawing's paths re-spaced for the 52 px pitch (each y mapped `(y − 16) × 52/32 + 16`, dot
  and ring radii kept), so the lanes run unbroken through both lines.
- [ ] App · Commits (`DtWFt`): new `Variants · How a commit row reads` (`k0xLo4`, amber) at the end of the frame, after
  CH41's row, with an intro and one row per variant.
- [ ] `CH62 · Variant A · One line that uses its room` (`n8u560`): copy of CH3 (sidebar, ref list, a 924 px list) with
  the natural-author pane; every headline and name whole at this width.
- [ ] `CH63 · Variant A · One line that uses its room, details open` (`e8JrOf`): copy of CH18 (a 484 px list beside
  `Commit details`), c02 selected; under 640 px the names are off and the avatars stay, as today; 11 of 24 headlines
  cut with an ellipsis.
- [ ] `CH64 · Variant B · Two lines, metadata below` (`f4XIii`): copy of CH3 with the two-line pane; nothing cut.
- [ ] `CH65 · Variant B · Two lines, metadata below, details open` (`GNVkW`): copy of CH18, c02 selected; the sha and
  its separator off below 640 px; 6 of 24 headlines cut.
- [ ] `CH66 · Variant B · The selected and hovered row` (`l1o6L`): two actual-size crops (720 px wide, 484 px with
  details open) of the two-line pane, c02 selected (`$sel`, accent outline at 30 %, `$accent` ring) and c04 hovered
  (`$bg-3`, ring `#656C7680`), as CH54.
- [ ] `CH67 · Variant C · Two lines, refs on the headline line` (`i1Ys6o`): copy of CH3 with the refs-first pane.
- [ ] `CH68 · Variant C · Two lines, refs on the headline line, details open` (`HYZiO`): copy of CH18, c02 selected;
  sha off; 10 of 24 headlines cut.

Rows per 900 px of list: 28 at 32 px (A, today), 17 at 52 px (B, C).
