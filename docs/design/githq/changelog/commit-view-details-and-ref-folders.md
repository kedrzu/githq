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

## Round 2 · agent brief

Asked (`.context/commit-view-brief-2.md`): the owner rejected CH50 (one label column reads as noise, though its failing
check unfolded under Checks is liked) and CH51 (chips without labels), and picked CH52's structure with two faults: the
tabs read as labels, and failing checks must not hide behind a tab. Two refinements of CH52 without tabs, and two states
of the recommended one. Changed: CH50 and CH51 deleted, a shared facts component with two variants, four new panels.

- [ ] Components · Commits › Parts (`C2tGlJ`): new `Commit details / Facts` (`NIaPG`), 400 wide: the headline (15 px,
  600), the meta line (avatar, name, age · date, sha with copy) and a card (`$border`, radius 8) of four groups divided
  by `$border` lines, each with its own head (11.5 px, 500, `$fg-dim`): **Pull request** (state icon, number, the title
  clipped to one line, `merged`; ⇧↵ in the head), **Checks** (`1 failing` in `$red` and `of 12` in the head; the failing
  check on `$bg-3` with name, duration and ↗; `11 passed ›` folded under it), **Parents** (one row each: P / ⇧P key, sha,
  headline clipped), **Refs** (one line: label then chips). The parents take the full width rather than sharing a row
  with refs: beside refs a parent's headline kept ~20 characters. Hidden `Commit / Not known yet` bars in the Pull
  request value and in a `CI not known row` under Checks.
- [ ] Components · Commits › Parts (`C2tGlJ`): new `Commit details / Facts · checks passed, no pull request` (`REdEU`),
  an instance of the facts: a commit pushed to main (`d07be52`, parent `3f9c2e1`, `main` only); Pull request reads
  "Pushed straight to main, no pull request" in `$fg-dim` with a `$fg-3` icon, no key; Checks only `12 passed ›`; one
  parent.
- [ ] Components · Commits › Parts (`C2tGlJ`): new `Commit details / Facts · not known yet` (`CFnEm`): the Pull request
  value and the check list swapped for the empty bars (120 and 72 px), no ⇧↵; parents and refs as known.
- [ ] App · Commits › `Variants · How a commit's details read` (`WCpKZ`): deleted `CH50 · Variant A · A property sheet
  above the message` and `CH51 · Variant B · A header with chips` with their slots; CH52 stays last as the round-1
  reference, its caption saying so. Order now CH55, CH57, CH58, CH56, CH52.
- [ ] `WCpKZ`: new `CH55 · Variant A · C, one scroll` (`BMfTt`), recommended: `Item / Toolbar` as in CH52, then one
  scroll area (padding [16,20,24,20], gap 20) holding the facts and `Commit details / Message`. Why recommended: the
  failing check is on the first screen without a key, and the long message gets the whole panel once the card scrolls
  away.
- [ ] `WCpKZ`: new `CH56 · Variant B · C, facts fixed` (`Ip4d5`): the facts fixed under the toolbar (padding 16/20, a
  `$border` bottom line); the message scrolls alone below, drawn a few lines down, with a 14 px shade (`#00000059` →
  transparent) under the edge. The caption names the cost: ~330 px of the panel taken for good, two scroll areas.
- [ ] `WCpKZ`: new `CH57 · Variant A · Checks passed, no pull request` (`Yuudr`): CH55 with the passed variant, the
  toolbar's sha `d07be52`, the message one paragraph (the message's list, second paragraph and trailers hidden).
- [ ] `WCpKZ`: new `CH58 · Variant A · Pull request and checks not known yet` (`egAi8`): CH55 with the not-known
  variant.

Not drawn: the chosen variant on CH18, CH20, CH42, CH48 and `Commit details` (`CKaTw`) still waits for the owner's
pick; the 11 passed checks unfolded; a commit with several failing checks (the list grows under Checks, one row each).
