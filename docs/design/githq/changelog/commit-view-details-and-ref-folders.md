# Commit view: details, ref folders, the selected row

A commit's details put the one-line facts (pull request, checks, refs, author, date, parents, sha) above the message and
show the message in the normal text colour, readable, since a squash message can run 20–60 lines. The branch and tag
list nests names by `/` into folders, so a hundred `testing/v…` tags never flood it. The selected and hovered commit
row light the whole row, graph column included, with a ring on the dot. Base: `834101f6`.

## Round 1 · agent brief

Asked (`.context/commit-view-brief.md`): three variants of the details panel (CH50–CH52), folders in the branch and tag
list (CH53), the selected and hovered commit row (CH54). Changed: a `Variants` frame with three panels, two new screens,
four new parts, a reusable rendered message, `Commit row` reworked so the change reaches every screen.

- [x] Components · Commits › Parts (`C2tGlJ`): new `Commit details / Message` (`c1E2q`): the commit body rendered,
  `$fg` at 14 px, line height 1.6: paragraphs, a list with hanging bullets (`$fg-3` bullet, gap 10), trailers
  (`Closes …`, `Co-authored-by: …`) in `$fg-2` at 12.5 px. Used by all three variants.
- [x] App · Commits (`DtWFt`): new `Variants · How a commit's details read` (`WCpKZ`, amber), after CH20's row, holding
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
- [x] Components · Commits › Parts (`C2tGlJ`): new `Ref list folder` (`LbvAS`): chevron 12 px, folder icon, name
  (mono 12, `$fg-2`), count (mono 11, `$fg-dim`), padding [5,10] like `Ref list row`; `Ref list folder · open`
  (`x4Hfm`): `chevron-down`, `folder-open`; `Ref list row · in a folder` (`lF1Ct`), a `Ref list row` indented to
  padding-left 28 so its icon sits under the folder's icon; `Ref list folder · show more` (`iSknk`): `chevrons-down`,
  "Show 122 more · newest 20 shown", indented the same.
- [x] App · Commits (`DtWFt`): new row `Row of screens · Folders` (`KLsDj`) after CH15–CH17, with `CH53 · Folders in
  the branch and tag list` (`bzHvk`): the list at 280 px, full height: `main` (default); Branches 13: `feature`
  unfolded (login, search, billing-export, last segment only), `fix` (7) and `kedrzu` (2) folded, loose `develop`;
  Tags 152: `testing` unfolded with v178–v159 and Show 122 more, `release` (9) folded, loose `v1.0.0`. `login` is
  hovered (`$bg-3`) with a tooltip giving its full name `feature/login`. The caption says how depth, order, folding
  (→ / ←) and filtering behave.
- [x] Commit row (`EMjBX`): the surface now spans the graph column. Row padding [0,8,0,0] → [0,8,0,4]; the `Graph`
  spacer (`tze97`) moved from the row into `Surface` (`kFDB3`) as its first child, height 32 → 28; the surface's
  padding [0,12,0,8] → [0,12,0,0]. The headline moves 4 px right (graph + 12 instead of graph + 8). The lanes are
  still drawn by each pane's `Graph drawing`, over the rows, so they run unbroken.
- [x] Commit row (`EMjBX`): new `Dot ring` (`gxMLU`) in the graph spacer, an ellipse 14 × 14, 1.5 px inner stroke
  `$accent`, hidden. A row shows it at its dot (`x` = dot's centre − 11, `y` 7): selected in `$accent`, hovered in
  `#656C7680` (`$fg-3` at 50%), 2 px out from the dot's 3.5 px radius.
- [x] The 219 rows of the ten `Commit graph / …` panes: moving the spacer dropped their graph widths; re-applied, same
  values (62, 98, 182, 38, 50, each its pane's drawing width). Nothing to build.
- [x] Selected commit rows on every screen (13 overrides: `YvExd`, `e9rali`, `CSIbx`, `t5ylMf`, `r0SGiG`, `VtHCg`,
  `h2wkJ`, `At5oP`, `v0ZFU`, `pmqyb`, `KZksk`, `cUGYA`, `PMoe9`): the surface gains the accent outline `#7B87F74D`
  1 px (it had `$sel` alone) and the dot its `$accent` ring.
- [x] App · Commits (`DtWFt`): new row `Row of screens · Selected row` (`tu3SX`) after CH12, with `CH54 · The selected
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

- [x] Components · Commits › Parts (`C2tGlJ`): new `Commit details / Facts` (`NIaPG`), 400 wide: the headline (15 px,
  600), the meta line (avatar, name, age · date, sha with copy) and a card (`$border`, radius 8) of four groups divided
  by `$border` lines, each with its own head (11.5 px, 500, `$fg-dim`): **Pull request** (state icon, number, the title
  clipped to one line, `merged`; ⇧↵ in the head), **Checks** (`1 failing` in `$red` and `of 12` in the head; the failing
  check on `$bg-3` with name, duration and ↗; `11 passed ›` folded under it), **Parents** (one row each: P / ⇧P key, sha,
  headline clipped), **Refs** (one line: label then chips). The parents take the full width rather than sharing a row
  with refs: beside refs a parent's headline kept ~20 characters. Hidden `Commit / Not known yet` bars in the Pull
  request value and in a `CI not known row` under Checks.
- [x] Components · Commits › Parts (`C2tGlJ`): new `Commit details / Facts · checks passed, no pull request` (`REdEU`),
  an instance of the facts: a commit pushed to main (`d07be52`, parent `3f9c2e1`, `main` only); Pull request reads
  "Pushed straight to main, no pull request" in `$fg-dim` with a `$fg-3` icon, no key; Checks only `12 passed ›`; one
  parent.
- [x] Components · Commits › Parts (`C2tGlJ`): new `Commit details / Facts · not known yet` (`CFnEm`): the Pull request
  value and the check list swapped for the empty bars (120 and 72 px), no ⇧↵; parents and refs as known.
- [x] App · Commits › `Variants · How a commit's details read` (`WCpKZ`): deleted `CH50 · Variant A · A property sheet
  above the message` and `CH51 · Variant B · A header with chips` with their slots; CH52 stays last as the round-1
  reference, its caption saying so. Order now CH55, CH57, CH58, CH56, CH52.
- [x] `WCpKZ`: new `CH55 · Variant A · C, one scroll` (`BMfTt`), recommended: `Item / Toolbar` as in CH52, then one
  scroll area (padding [16,20,24,20], gap 20) holding the facts and `Commit details / Message`. Why recommended: the
  failing check is on the first screen without a key, and the long message gets the whole panel once the card scrolls
  away.
- [x] `WCpKZ`: new `CH56 · Variant B · C, facts fixed` (`Ip4d5`): the facts fixed under the toolbar (padding 16/20, a
  `$border` bottom line); the message scrolls alone below, drawn a few lines down, with a 14 px shade (`#00000059` →
  transparent) under the edge. The caption names the cost: ~330 px of the panel taken for good, two scroll areas.
- [x] `WCpKZ`: new `CH57 · Variant A · Checks passed, no pull request` (`Yuudr`): CH55 with the passed variant, the
  toolbar's sha `d07be52`, the message one paragraph (the message's list, second paragraph and trailers hidden).
- [x] `WCpKZ`: new `CH58 · Variant A · Pull request and checks not known yet` (`egAi8`): CH55 with the not-known
  variant.

Not drawn: the chosen variant on CH18, CH20, CH42, CH48 and `Commit details` (`CKaTw`) still waits for the owner's
pick; the 11 passed checks unfolded; a commit with several failing checks (the list grows under Checks, one row each).

## Round 3 · agent brief

Asked (`.context/commit-view-brief-3.md`): in the branch and tag list (CH53) the pull request number blended with the
branch name (both mono, the number barely greyer) and sat too far from its icon; the graph rows had the same loose gap.
The owner suggested a small frame. Changed: the pull request mark became one shared chip used by the graph rows, the
branch list rows and the details' facts; a new screen shows it at actual size and 2×.

- [x] Components · Commits › Atoms (`zeINb`): new `Commit / PR chip` (`O4txr`): 16 px tall, padding [0,4], gap 3,
  radius 4, 1 px inner `$border` stroke; `PR state` icon 12 px (`lrpWJ`), `PR number` mono 11.5 `$fg-2` (`SbqSG`).
  New `Commit / PR chip · hover` (`aOd0f`): stroke and number `$fg`. The chip is a link to the pull request.
- [x] Commit row (`EMjBX`): in `PR` (`RHE4I`) the icon `LVRNW` (13 px) and number `DR8rO` (gap 5) → a `PR chip`
  instance (`S6abg`); `PR not known` (`VRxZq`) stays beside it, outside the chip. The CI mark stays where it was, after
  the chip.
- [x] Ref list row (`Bcpzl`): the loose icon `kdsag` and number `tsytt` (mono 11, `$fg-dim`, row gap 8) → a `PR chip`
  instance (`m381rf`), same place; the number is now `$fg-2` at 11.5. The row stays 26 px (the chip is the name box's
  16 px). Reaches `Ref list row · selected` (`eVXEC`), `Ref list row · in a folder` (`lF1Ct`), both ref lists and
  CH3, CH15–CH17, CH53.
- [x] Commit details / Facts (`NIaPG`): in the Pull request value (`KRVg7`) icon `rVBwa` and number `GhsD7` → a
  `PR chip` instance (`K7V16F`); new hidden `No pull request` icon (`V4wIwL`, 13 px `$fg-3`) for a commit with none.
  `…· checks passed, no pull request` (`REdEU`) hides the chip and shows that icon; `…· not known yet` (`CFnEm`) hides
  the chip, the bar shows as before. Reaches CH55–CH58.
- [x] Overrides of the 402 instances that pointed at the replaced nodes moved to the chip's paths (icon and number
  overrides onto the chip's icon and number; icon and number both hidden → the chip hidden). Nothing to build.
- [x] App · Commits › `Row of screens · Folders` (`KLsDj`): new `CH59 · The pull request as a chip` (`Q8tHB`, slot
  `iVq38`) after CH53: CH53's list at actual size (no tooltip; `login`'s chip hovered), CH54's seven graph rows at
  actual size (the hovered row's chip hovered), two list rows and a graph row's end drawn at 2×, and notes.

Not changed: `Item / Linked` (`MGnYu`, the issue's linked pull request card) keeps its loose number; it is not the
commit view's mark.

## Round 4 · agent brief

Asked (`.context/commit-view-brief-4.md`): the owner's feedback on CH59 (1 px more padding in the chip; half the gap
between a graph row's headline and its chip), and the settled choices applied everywhere: the details panel is CH55,
the variants resolved, folders in every branch and tag list, every selected row checked. Changed: two components
retuned, `Commit details` rebuilt on the facts and the message, the `Variants` frame gone, folders in every list.

- [x] Commit / PR chip (`O4txr`): height 16 → 18, padding [0,4] → [1,5]. Reaches `· hover` (`aOd0f`), the graph rows,
  the ref list rows and the facts.
- [x] Ref list row (`Bcpzl`): height fit → 26 fixed, padding [5,10] → [0,10], so the 18 px chip doesn't grow it;
  `Ref list row · in a folder` (`lF1Ct`) padding [5,10,5,28] → [0,10,0,28]. Rows stay 26 px.
- [x] Commit row (`EMjBX`): new `Headline` frame (`eAF8P`, gap 4, height 18) in `Surface` holding `Message cell`
  (`QL19z`) and `PR` (`RHE4I`); `PR`'s padding-left 4 → 0. Headline → chip 12 → 4 px; chip → CI mark stays 8 px; the
  surface stays 28 px.
- [x] Moving `Message cell` and `PR` dropped the instance overrides that pointed into them (853 keys in 229 instances:
  headlines, refs, chips, hidden PR marks, the screens' truncated headlines); restored from `HEAD`. Nothing to build.
- [x] Commit details / Facts (`NIaPG`): new hidden `Failing check 2` (`HnGZA`) under the failing check, for a commit
  with two; new hidden `Ref branch` (`NobMY`, a `Commit / Ref · branch`) first in the refs; new hidden `Refs none`
  (`gM8aD`, 12.5 px `$fg-dim`) for a commit no ref points at.
- [x] Commit details (`CKaTw`): rebuilt as CH55. The scroll (padding [16,20,24,20], gap 20) holds the `Notice` (kept,
  hidden), `Facts` (`AGnlT`, an instance of `NIaPG`) and `Message` (`ZDGIn`, an instance of `c1E2q`). Removed: the
  headline, body, meta, parents, refs, the `Item / Linked` pull request card, the CI line and the `Keys` footer. The
  toolbar hides the Arrangement button as CH55 does. Its commit stays `e81c4a2` (`fix: booking time uses the studio's
  timezone`, Marta Laine, #1228 open, 2 failing of 9 checks named, 7 passed, parent `4be91d0`, `fix/booking-tz`), the
  message one paragraph and `Refs #1187`. Reaches `Commit details / bottom` (`sVyY2`) and CH18, CH42, CH48, CH27.
- [x] Instances of `Commit details` with their own commit, overrides moved to the facts and message: CH16 (`SYbeQ`:
  release 3.9.1, Sam Becker, no pull request, 9 passed, parent sha only, tag `v3.9.1`, the notice), CH20 (`Bwf4W`:
  the merge, #1226 merged, two parents, `main`, 12 passed), CH28 (`I5SpAE`: `4be91d0`, 9 passed, parent `0a7e3c1`,
  refs "None"), CH41 (`QcGmF`: the notice, refs "None any more"). CH18, CH27, CH42, CH48 take the default.
- [x] App · Commits (`DtWFt`): deleted `Variants · How a commit's details read` (`WCpKZ`) with `CH52 · Variant C · Facts
  fixed, the message in tabs` and `CH56 · Variant B · C, facts fixed`. New `Row of screens · The panel` (`arqcr`) after
  CH20's row, holding the three chosen panels, renamed: `CH55 · One scroll: the facts, then the message` (`BMfTt`),
  `CH57 · Checks passed, no pull request` (`Yuudr`), `CH58 · Pull request and checks not known yet` (`egAi8`), slots
  and captions the same; "Variant A" and "Recommended" dropped from the captions. No amber left in the frame.
- [x] Components · Commits › Parts (`C2tGlJ`): new `Ref list row · selected, in a folder` (`PhUDv`), an instance of
  `lF1Ct` with `$sel` and the icon `$fg-2`, after `lF1Ct`.
- [x] Ref list / fitloop/webapp (`JCWhs`): the seven prefixed branch rows → folded folders `feat` 1, `fix` 1,
  `release` 2, `spike` 1, `renovate` 1, `docs` 1, then `gh-pages`. Reaches CH3, CH15, CH16, CH18, CH20, CH23, CH24,
  CH26–CH29, CH31–CH36, CH40, CH41, CH47, CD4, CD6. CH32's overrides on the removed rows deleted.
- [x] Ref list / nuxt/nuxt (`H98y7`): the eleven prefixed branch rows → folded folders `renovate` 22, `fix` 12, `feat`
  18, `docs` 6, `perf` 3, `refactor` 4, then `nitro-v3` and `3.x` (67 in all); the "53 more branches" note and its
  frame removed. Reaches CH10, CH11, CH44, CH45.
- [x] CH6, CH46, CH42 lists (`xRuvw`, `P9lmm`, `K4zv6`): the same folded folders as `JCWhs`.
- [x] CH25 (`uIg6J`): "book" unfolds `fix` (`rb4N7`, open) around the match; the match is a `Ref list row · selected, in
  a folder` (`lbdta`) with its full name, cut to `fix/booking…` where the row runs out. Caption says so.
- [x] CH17 (`bDTtx`): a `testing` folder (`hrB5l`, open, 4) unfolded around four matches with full names
  (`testing/v3.19.3-rc.2`, `-rc.1`, `testing/v3.19.0-rc.1`, `testing/v3.18.0-rc.1`), before the loose tags; the five
  oldest loose tags dropped to keep the column's height. Caption says how it folds back.
- [ ] Desktop · Commits CD2, CD3, CD5, CD7 (`zsRfC`, `en41z`, `jyMiC`, `Fd4dV`): `feat` (2) and `fix` (1) unfolded with
  their branches as rows in a folder and their worktrees under them (wrapper padding 18 → 36); `release`, `spike`,
  `renovate` folded. CD2's caption says so.
- [x] CH59 (`Q8tHB`): the 2× chips height 32 → 36, padding [0,8] → [2,10]; the 2× list rows height 52, padding
  [0,20,0,56]; the 2× graph row's headline and chip in a `Headline` frame (`N4uNh`, gap 8), `PR` padding 0. Notes and
  caption give 18 px, 1/5 px padding, 4 px to the headline, 8 px to the CI mark.
- [x] Captions: CH18 (the panel is CH55's, the Checks group says red), CH53 (matched rows show full names while
  filtering).

Checked, nothing to change: the 17 selected rows all have `$sel`, the accent outline and the ring; no loose pull request
number, old panel or flat prefixed name is left in App · Commits or Desktop · Commits; App · Repository shows neither
the graph nor the details.

## Round 5 · agent brief

Asked (`.context/commit-view-brief-5.md`): a real sort dropdown on each group of the branch and tag list, applied
everywhere (settled), and three variants of how a failing commit shows once every lane has its own colour (the owner
wants the graph closer to Fork's). Changed: three button states and a menu as components, `Ref list section` carrying the
button, a new screen; eight lane colours as variables; an amber `Variants` frame with the palette and three variants.
The existing screens keep their grey lanes until a variant is picked.

- [x] Components · Commits › Atoms (`zeINb`): new `Ref list sort` (`zwGis`): 18 px tall, padding [0,3,0,6], gap 3,
  radius 4, 1 px inner `$border-2` stroke; `Order` (`rJori`) 11 px `$fg-2`, "Newest first"; `Chevron` (`vc5t1`)
  `chevron-down` 12 px `$fg-3`. New `Ref list sort · hover` (`F54Nvj`): fill `$bg-3`, stroke `$fg-3`, label `$fg`,
  chevron `$fg-2`. New `Ref list sort · open` (`o3wZHM`): as hover, the chevron `chevron-up`.
- [x] Components · Commits › Parts (`C2tGlJ`): new `Ref list sort menu` (`CdB0y`) after `Ref list section`: 168 wide,
  `$bg-2`, radius 8, `$border-2` stroke, the shadow of `Activity / Comment menu`, padding 4, two `Activity / Menu item`
  instances, "Newest first" (`X2hxOg`) and "By name" (`SLAvy`), the current one's icon a `check` in `$accent`, the other's
  the same check transparent so the labels align. New `Ref list sort menu · by name` (`ME5z9`): the check on By name.
- [x] Ref list section (`O0IBWH`): the hidden text `Right` (`aKo9W`, "by last commit", shown as "newest first" by every
  instance) → a `Ref list sort` instance `Sort` (`hMXTr`), shown by default; padding [12,10,4,10] → [10,10,3,10] so the
  section stays 31 px. The `aKo9W` overrides of all 30 instances removed; `Sort` hidden where the group can't be sorted:
  App · Repository's "Its issues live in" (`fjJsq`) and "Its pull requests live in" (`V5U5W`), CH25's empty Tags
  (`d4F16y`), CH39's empty Branches (`yV5ko`). Every list now shows "Newest first" on both groups: CH3, CH6, CH10, CH11,
  CH15–CH17, CH42, CH44–CH46, CH53, CH59, CD2, CD3, CD5, CD7 and the panes in Components · Commits.
- [x] App · Commits › `Row of screens · Folders` (`KLsDj`): new `CH60 · Sorting the list` (`F7mkm`, slot `kAYNm`) after
  CH59: two lists at 280 px. Left, "Picking By name in the Branches menu": Branches' button open (`Sort` replaced by
  `Ref list sort · open`), the menu (`z7SShM`) 4 px under it, right edges aligned, By name highlighted `$sel` under the
  pointer. Right, "Branches by name": the button reads "By name"; `feature` (billing-export, login, search) and `fix`
  unfolded, `fix` in natural order (booking-tz, hld-9-retry, hld-98-week, hld-99-dst, hld-100-ical, hld-104-seats,
  rate-limit; newest first on the left), `kedrzu` folded, loose `develop` after the folders as CH53's rule says; Tags
  unchanged, Newest first. The caption gives the keys (↵ opens, ↑/↓ and ↵ pick, Esc closes), the order kept per group
  on the device per repository (the agent's guess), the default branch staying on top and folding kept.
- [x] Variables: new `graph-lane-1` … `graph-lane-8`: `#5899E4` blue, `#91B54A` lime, `#B190EA` violet, `#41AA90` teal,
  `#C784CD` orchid, `#39AEC6` cyan, `#5DB669` green, `#86AECB` steel, each 5.7:1 to 8.1:1 on `$bg`, the stripe and
  `$sel`; new `graph-line-main` `#8B929B`, the code's token of the same name, so far a literal in the file. No red, amber
  or indigo (failing, running, the selection ring); ordered so neighbouring lanes differ most. Used only in the variants.
- [x] App · Commits (`DtWFt`): new `Variants · Failing CI on a coloured lane` (`v1rQdK`, amber) after CH54's row: an
  intro, `Lane palette` (`pw4ow`: nine swatches with value and contrast, the lanes and dots drawn on `$bg`, the stripe
  and `$sel`, and why the default branch keeps its grey: the trunk stays the neutral line the branches leave and join,
  and the accent is the selection ring's), then three screens, each the same twelve rows (`Commit row` instances, 800
  wide, graph 74 px: main grey and four coloured lanes, a merge from `feat/member-search`, `fix: booking time…` failing
  on `fix/booking-tz` and selected, `fix: member list loads twice` failing on main and hovered, `feat: preview a class…`
  running) with the graph column at 3× beside them. Dots r = 3 (was 3.5), filled in their lane's colour; merges a 1.5 px
  ring in the lane's colour on `$bg`; lines 1.5 px in the lane's colour; the 14 px rings of CH54 unchanged.
  - `CH61 · Variant A · A red centre inside the lane's ring` (`scrBz`), recommended: failing is a circle r = 3.25 filled
    `$red` with a 1.5 px stroke in the lane's colour (r = 4 overall), running the same in `$amber`.
  - `CH62 · Variant B · The dot turns red, a red notch on the lane` (`YbZhD`): a plain `$red` dot r = 3.5 and the lane
    drawn red 10 px above and below it, 2 px; running in `$amber`.
  - `CH63 · Variant C · A red halo round the lane-coloured dot` (`ef4Ez`): the dot as any other, a 1.5 px `$red` ring at
    r = 5.25 round it; running in `$amber`. Drawn with its clash: the selected and hovered rings land on the halo. The
    caption names the ✕ glyph as the idea not drawn.

Not changed: the lanes and dots of the ten `Commit graph / …` panes and every screen (waiting for the owner's pick);
`Commit row`'s ring (14 px, now 2.5 px out from an r = 3 dot); D15's "each newest first" in
`docs/design/git-client/DECISIONS.md` still to say the order is chosen per group.

## Round 6 · agent brief

Asked (`.context/commit-view-brief-6.md`): the owner picked CH61 · Variant A with 1 px of the row's own background
between the lane-coloured outline and the red (or amber) centre; coloured lanes applied to every graph; the variants
resolved; CH60's caption corrected (the sort is a synced user preference). Changed: the ten graph panes redrawn by lane,
the dot ring enlarged, CH61 and the palette moved into an ordinary row, the `Variants` frame gone.

- [x] The `Graph drawing` of the ten `Commit graph / …` panes (`g6kfP` Few branches, `r6W7Ds` Many branches · capped,
  `T0aoP` · every lane, `jaTAI` · three lanes, `YAAi9` First page, `xOlz1` Few branches · not known yet, `a5Qvh` One
  branch, `o9mwGt` The beginning, `MRr2O` After a force-push, `lgXeK` Local clone): the grey `Lines`, `Lines default
  branch`, `Commits`, `Merges`, `Commits failing` and `Commits running` paths → one path per lane and kind, named
  `Lines · lane N`, `Commits · lane N`, `Merges · lane N`, `CI rings · lane N`, `Failing centres`, `Running centres`
  (and `· main`, `· fold`). Colour by column: the default branch's column `$graph-line-main` (`#8B929B`, was a literal);
  column n ≥ 1 `$graph-lane-((n − 1) mod 8 + 1)`; a curve between two columns takes the one farther from the trunk (the
  branch's). Dots r = 3 (was 3.5) filled in the lane's colour (was `#9198A1`). Merges a 1.5 px ring r = 3 in the
  lane's colour, unfilled (was `$bg` fill, `#9198A1` stroke). Failing and running: a 1.5 px ring r = 4.25 in the lane's
  colour (3.5–5 px), 1 px gap, a disc r = 2.5 in `$red` / `$amber` (was a plain disc r = 4 / 3.5). The lines are cut
  inside every failing, running and merge ring, so the gap and a merge's inside show the row's own background (`$bg`,
  the stripe, `$sel`, the hover). One-branch and The beginning have no default-branch path; their leftmost column is
  the default branch.
- [x] Folded lanes (`r6W7Ds`, `jaTAI`; CH10, CH17, CH44, CH45): the fold column is neutral, not a lane: `Lines folded`
  (3 px) and the curves into it stay `$graph-line` (`#656C76`, the dimmer grey, so the fold doesn't read as the
  trunk); the dots and CI rings on it `$graph-line-main`.
- [x] Commit row (`EMjBX`) › `Dot ring` (`gxMLU`): 14 × 14 at (3, 7) → 16 × 16 at (2, 6), 1.5 px inner stroke as
  before: 1.5 px clear of a failing or running dot's outline, 3.5 px from a plain dot. The 23 instance overrides of its
  `x` moved 1 px left (`YvExd`, `qslXI` ×2, `S8pU7q` ×2, `e9rali`, `CSIbx`, `t5ylMf`, `r0SGiG`, `VtHCg`, `h2wkJ`,
  `At5oP`, `v0ZFU`, `pmqyb`, `KZksk`, `cUGYA`, `PMoe9` and the six rows of CH61–CH63).
- [x] Screens following the panes (nothing overridden in the drawings): CH3, CH6, CH10, CH11, CH12, CH15–CH18, CH20,
  CH23–CH29, CH31–CH36, CH39–CH42, CH44–CH48, CH54, CH59, CD2–CD7.
- [x] CH54 (`bEoEQ`) › `Rows at 3×` (`JR2zo`): the six grey paths → the recoloured paths of `g6kfP` at 3× (viewBox
  `[0,0,62,160]`, strokes 4.5); `Ring · selected` (`JdXkh`) and `Ring · hover` (`D0W8gj`) 42 → 48 px, x 93 → 90, y −3.
- [x] CH61 (`scrBz`): `Actual size` drawing (`fziJ0`) and `Rows at 3×` (`ikaW4`): the failing and running dots c01,
  c02, c06 → a lane-coloured ring r = 4.25 plus a new `Dot c0N · centre` disc r = 2.5; the merge c03 unfilled; the
  lanes cut inside those rings; the 3× rings (`d2RHE`, `vt9gu`) 42 → 48 px.
- [x] App · Commits (`DtWFt`): new `Row of screens · Lane colours` (`v6B8Ha`) after CH54's row, holding the CH61 slot
  (`MDjZF`) and `Lane palette` (`pw4ow`), both moved out of `Variants · Failing CI on a coloured lane` (`v1rQdK`),
  which is deleted with its intro, `CH62 · Variant B · The dot turns red, a red notch on the lane` (`YbZhD`) and
  `CH63 · Variant C · A red halo round the lane-coloured dot` (`ef4Ez`) and their slots. Renamed: `CH61 · A red
  centre inside the lane's ring` (slot, screen, caption; "Variant A · " and "Recommended" dropped). No amber left.
- [x] Captions: CH61 (`fIxzC`: the gap, r = 5 overall, the 16 px rings, every graph draws it), the palette note
  (`rlDzy`: the fold stays neutral), CH54 (`glxYV`, note `eToC4`: 16 px ring, 3.5 / 1.5 px), CH12 (`woMK8`: red and
  amber as the dot's centre in a lane-coloured ring), the graph group note (`ShEcf`: lanes in colour, the default
  branch grey), CH10 (`fNPk8`) and CH44 (`d7i5i`: the fold stays grey), CH33 (`KuFvk`: a dot stays plain in its
  lane's colour until its CI is known).
- [x] CH60 (`eiGXN`): "the choice is kept on the device per repository" → the order is a user preference kept in the
  synced settings, one choice for Branches and one for Tags, the same in every repository.

Not changed: `$graph-line` stays (the fold); `docs/design/git-client/DECISIONS.md` D15 still says "each newest first"
(round 5). The code's graph has no `graph-lane-*` tokens yet.

## Round 7 · implementation

Asked (`.context/commit-view-brief-7.md`): bring the drawings in line with the built code (branch
`feat/commit-view-sidebar-refs-hover`) and tick what it implements. Forced by the code: `buildRefTree` makes no folder
of a prefix only one ref has; `flattenRefTree` ends every level cut at 20 with the same "Show N more" row, filtering or
not; `CommitRefList` draws the sort button on every Branches and Tags header, an empty one too, counts the default branch
among Branches, and folds a folder by click or ↵ (no → / ←); `CommitDetails` says "No pull request".

- [x] Ref list / fitloop/webapp (`JCWhs`): the folders `feat` 1, `fix` 1, `spike` 1, `renovate` 1, `docs` 1 → loose
  rows with full names (`feat/calendar-sync` `N8FoL9`, `fix/booking-tz` `RJpc1`, `spike/redis-queue` `HQPqf`,
  `renovate/vite-6.x` `Ojysu`, `docs/onboarding` `sxy4q`, their chips, CI and ages as before round 4); `release` 2
  stays a folder and moves first (folders before refs). Seven rows as before. Reaches its 22 instances (CH3, CH15,
  CH16, CH18, CH20, CH23, CH24, CH26–CH29, CH31–CH36, CH40, CH41, CH47, CD4, CD6).
- [x] CH6, CH46, CH42 lists (`xRuvw`, `P9lmm`, `K4zv6`): the same flattening, `release` first.
- [x] CH25 (`uIg6J`): the open `fix` folder (`rb4N7`) deleted; the match `lbdta` (`Ref list row · selected, in a
  folder`, "fix/booking…") → `Rd4gm`, a `Ref list row · selected` reading `fix/booking-tz`. Caption (`xhp5T`): the only
  branch under `fix/` has no folder.
- [x] Desktop · Commits CD2, CD3, CD5, CD7 (`zsRfC`, `en41z`, `jyMiC`, `Fd4dV`): the open `fix` 1 folder deleted, its
  `fix/booking-tz` back to a loose `Ref list row` with its full name, its worktree's padding-left 36 → 18; the folded
  `release` 1, `spike` 1, `renovate` 1 → loose rows `release/4.2`, `spike/redis-queue`, `renovate/vite-6.x`. `feat` 2
  stays unfolded. One row shorter. CD2's caption (`A1Cpfp`) says why.
- [x] Ref list folder · show more (`iSknk`): the `Note` "· newest 20 shown" (`Mj3Vy`) hidden; the row reads "Show N
  more" alone, as the code does. Reaches CH53, CH59.
- [x] Components · Commits › Parts (`C2tGlJ`): new `Ref list folder · show more, top level` (`DRgij`), an instance of
  `iSknk` with padding [5,10] (left 28 → 10), for a group's own level, after `iSknk`.
- [x] CH17 (`bDTtx`): the note "9 more · keep typing" (`OMVdd`) → a `Show 15 more` row (`MYBht`, top-level variant);
  nine loose tags added (`v3.15.3` … `v3.13.0`) so the level draws its 20 (the `testing` folder and 19 tags); Tags
  24 → 38. Caption (`HSIBm`) says filtering keeps the 20 per level and the same row.
- [x] CH25 empty Tags (`d4F16y` → `r5QO6`) and CH39 empty Branches (`yV5ko` → `BnTsS`): the `Sort` button shown (the
  hide override removed); CH39's Branches count 0 → 1 (the default branch counts). The hidden sorts of App ·
  Repository's "Its issues live in" and "Its pull requests live in" stay.
- [x] Commit details / Facts · checks passed, no pull request (`REdEU`): "Pushed straight to main, no pull request"
  → "No pull request".
- [x] Captions: CH53 (`E9iRW`: a single ref makes no folder; click or ↵, not → / ←; each level 20 then Show N more),
  the list's group note (`k9veH`: folders, the sort, 20 per level and Show N more).

Checked, nothing to change: `Commit row` (`EMjBX`) puts its surface 4 px from the left, 8 px from the right, 2 px from
top and bottom, as the code's `--row-surface-inset`; every Branches and Tags header has the `Ref list sort` button
("Newest first" / "By name", 12 px chevron), no quiet "newest first" text left; CH59's notes, caption and 2× drawings
already give the 18 px chip with 1 / 5 px padding (36 px, 2 / 10 at 2×); `Ref list / nuxt/nuxt` and CH53, CH59, CH60
have no folder of one.

Ticked in rounds 1–6: everything the code builds — the CH55 panel and its facts, the message, the folders and their
"Show more", the whole-row surface and rings, the PR chip, the sort button and menu, the coloured lanes, the failing
marker. Ticked as nothing to build: the variant screens later rounds removed (CH50–CH52, CH56, CH62, CH63) and their
deletions. Parts the code does differently are corrected by this round's entries, not left unticked. Left unticked:
round 4's Desktop · Commits CD2, CD3, CD5, CD7 entry: worktrees and local clones are the desktop's second step, not
built yet. Not changed: CH47's caption (`G99pe`) is wider than its slot, from an earlier round.
