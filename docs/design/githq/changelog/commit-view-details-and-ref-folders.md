# Commit view: details, ref folders, the selected row

A commit's details put the one-line facts (pull request, checks, refs, author, date, parents, sha) above the message and
show the message in the normal text colour, readable, since a squash message can run 20–60 lines. The branch and tag
list nests names by `/` into folders, so a hundred `testing/v…` tags never flood it. The selected and hovered commit
row light the whole row, graph column included, with a ring on the dot. Base: `834101f6`.

## Round 1 · agent brief

Asked (`.context/commit-view-brief.md`): three variants of the details panel (CH50–CH52), folders in the branch and tag
list (CH53), the selected and hovered commit row (CH54). Changed: a `Variants` frame with three panels, two new screens,
four new parts, a reusable rendered message, `Commit row` reworked so the change reaches every screen.

- [ ] Components · Commits › Parts (`C2tGlJ`): new `Commit details / Message` (`c1E2q`): the commit body rendered,
  `$fg` at 14 px, line height 1.6: paragraphs, a list with hanging bullets (`$fg-3` bullet, gap 10), trailers
  (`Closes …`, `Co-authored-by: …`) in `$fg-2` at 12.5 px. Used by all three variants.
- [ ] App · Commits (`DtWFt`): new `Variants · How a commit's details read` (`WCpKZ`, amber), after CH20's row, holding
  three 440 × 826 panels with the same commit (`[HLD-688][Maintenance] Stale Pulumi state …` (#581), merged; two
  parents; `main` and `testing/v178`; 1 failing check of 12). The toolbar is `Item / Toolbar` as in `Commit details`,
  without the Arrangement button (its ⇧↵ belongs to the pull request).
  - `CH50 · Variant A · A property sheet above the message` (`x2kaeP`), recommended: headline as the title, then one
    sheet of 28 px rows, label column 92 px like `Item / Properties`: Pull request (state icon, number, title, ⇧↵),
    Checks (✕ 1 failing of 12, the failing check listed under it on `$bg-3` with its duration, the 11 passed folded
    into one row), Refs, Author, Committed, Parents (P and ⇧P on their rows), Commit (full sha, copy). A divider, then
    the message. No footer of keys: each key sits on its row. One scroll.
  - `CH51 · Variant B · A header with chips` (`k9FJP3`): byline and headline, then two rows of chips (pull request
    with state and ⇧↵, checks 1 / 12, sha; P and ⇧P parents, `main`, `testing/v178`), a Checks disclosure row naming
    the failing check, the message, the old footer of keys.
  - `CH52 · Variant C · Facts fixed, the message in tabs` (`cYntS`): headline, a meta line (author, age, date, sha) and
    a 2 × 2 grid of tiles (pull request, checks, parents, refs) fixed at the top; tabs Message and Checks; the message
    in its own scroll area.
- [ ] Components · Commits › Parts (`C2tGlJ`): new `Ref list folder` (`LbvAS`): chevron 12 px, folder icon, name
  (mono 12, `$fg-2`), count (mono 11, `$fg-dim`), padding [5,10] like `Ref list row`; `Ref list folder · open`
  (`x4Hfm`): `chevron-down`, `folder-open`; `Ref list row · in a folder` (`lF1Ct`), a `Ref list row` indented to
  padding-left 28 so its icon sits under the folder's icon; `Ref list folder · show more` (`iSknk`): `chevrons-down`,
  "Show 122 more · newest 20 shown", indented the same.
- [ ] App · Commits (`DtWFt`): new row `Row of screens · Folders` (`KLsDj`) after CH15–CH17, with `CH53 · Folders in
  the branch and tag list` (`bzHvk`): the list at 280 px, full height: `main` (default); Branches 13: `feature`
  unfolded (login, search, billing-export, last segment only), `fix` (7) and `kedrzu` (2) folded, loose `develop`;
  Tags 152: `testing` unfolded with v178–v159 and Show 122 more, `release` (9) folded, loose `v1.0.0`. `login` is
  hovered (`$bg-3`) with a tooltip giving its full name `feature/login`. The caption says how depth, order, folding
  (→ / ←) and filtering behave.
- [ ] Commit row (`EMjBX`): the surface now spans the graph column. Row padding [0,8,0,0] → [0,8,0,4]; the `Graph`
  spacer (`tze97`) moved from the row into `Surface` (`kFDB3`) as its first child, height 32 → 28; the surface's
  padding [0,12,0,8] → [0,12,0,0]. The headline moves 4 px right (graph + 12 instead of graph + 8). The lanes are
  still drawn by each pane's `Graph drawing`, over the rows, so they run unbroken.
- [ ] Commit row (`EMjBX`): new `Dot ring` (`gxMLU`) in the graph spacer, an ellipse 14 × 14, 1.5 px inner stroke
  `$accent`, hidden. A row shows it at its dot (`x` = dot's centre − 11, `y` 7): selected in `$accent`, hovered in
  `#656C7680` (`$fg-3` at 50%), 2 px out from the dot's 3.5 px radius.
- [x] The 219 rows of the ten `Commit graph / …` panes: moving the spacer dropped their graph widths; re-applied, same
  values (62, 98, 182, 38, 50, each its pane's drawing width). Nothing to build.
- [ ] Selected commit rows on every screen (13 overrides: `YvExd`, `e9rali`, `CSIbx`, `t5ylMf`, `r0SGiG`, `VtHCg`,
  `h2wkJ`, `At5oP`, `v0ZFU`, `pmqyb`, `KZksk`, `cUGYA`, `PMoe9`): the surface gains the accent outline `#7B87F74D`
  1 px (it had `$sel` alone) and the dot its `$accent` ring.
- [ ] App · Commits (`DtWFt`): new row `Row of screens · Selected row` (`tu3SX`) after CH12, with `CH54 · The selected
  and hovered commit row` (`bEoEQ`): seven rows of the few-branches graph at actual size, `fix: booking time…`
  selected and `fix: read the timezone…` hovered (surface `$bg-3`), beside the graph column at 3× drawn from the
  same paths, with notes.

Not drawn: the details in the chosen variant on CH18, CH20, CH42, CH48 and the `Commit details` component (`CKaTw`)
wait for the owner's pick; the ref list in CH3, CH15–CH17 and the column layout still draws flat names until folders
are settled; a filtering state with folders unfolded on their own is described in CH53's caption only.
