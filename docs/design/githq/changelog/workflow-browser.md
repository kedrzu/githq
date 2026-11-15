# Workflow browser

The Workflows section becomes a browser, not only a way to failures: Enter on a workflow opens it as an item (panel or
full screen) with its triggers, its state and a flat list of its runs; Enter on a run opens the run, a passing one at a
summary. Starting runs (dispatch with inputs, re-runs, cancel) is in the command menu. Decision: `docs/design/actions/DECISIONS.md#d15`.
Base: `50220f18`.

## Round 1 · agent brief

Asked (`.context/workflow-browser-brief.md`, not committed): three layouts of the workflow item, the screens that do not
depend on the layout, two ways to dispatch with inputs, the commands on a run and on a workflow.
Changed: 14 new screens in four rows below `r9wI8`, new components in a `Workflow item` group; no existing screen or
shared component touched.

- [x] Components · Workflows (`olSuI`): new group `Workflow item` (`Lxfnv`) with `Workflow / Run row` (`Y8FSMM`), its
  `· selected` state (`xB8bv`, deleted in round 2), `Workflow / Item head` (`oZJKi`), `Workflow / Trigger` (`G2ST7p`),
  `Workflow / Run filters` (`gTzqv`), `Workflow / Filter chip · active` (`L2hg3T`), `Workflow / Item · Deploy`
  (`p8dmLt`), `Workflow / List pane · narrow` (`i7cCCB`), `Workflow / Ref group` (`BtLBS`), `Workflow / Property`
  (`csWLC`).
- [x] Components · Workflows › Workflow item (`Lxfnv`): `Workflow / Command step` (`W4hVe`), `Workflow / Dispatch
  field` (`yQX5u`) and its `· focused` state (`bnUx8`). Built in PR 2 (starting runs).
- [x] App · Workflows (`IEyTW`): new `Variants · How a workflow opens` (`qFSU8`): `W28 · Variant A · Header and a flat
  run list` (`KCBL9`, recommended), `W29 · Variant B · Runs grouped by ref` (`wxTdb`), `W30 · Variant C · Two columns`
  (`qjQBQ`, 1920×1080 so the panel is 1300 px). Settled in round 2: W30 built, W28 and W29 deleted.
- [x] App · Workflows (`IEyTW`): new `W31 · Workflow full screen` (`wp5Sn`), `W32 · A passing workflow` (`BRkFo`), `W33 ·
  A workflow without workflow_dispatch` (`pbJHk`), `W34 · A passing run, opened at its summary` (`J8Gad`), `W35 · The
  Workflows list with the new keys` (`r5c1Mr`: ↵ Open workflow, F Latest failure).
- [x] App · Workflows (`IEyTW`): new `Variants · Running a workflow` (`cGeEi`): `W36 · Variant A · Picking the workflow,
  in the command menu` (`cgrai`), `W37 · Variant A · The form, filled, in the command menu` (`Tfe0G`), `W38 · Variant B ·
  A dialog` (`H59aHh`). Built in PR 2 (starting runs).
- [x] App · Workflows (`IEyTW`): new `W39 · After starting` (`JlrIz`), `W40 · Commands on a run` (`vyJvT`), `W41 ·
  Commands on a workflow` (`Ehh4p`). Built in PR 2 (starting runs).

Choices the brief left open, made by the agent: run rows on two lines in the panel (one line left ~70 px for the
title); the header's "Runs on" label hidden so three trigger chips fit; Variant B's `v*` group says "No runs on a tag
yet"; the narrow list hides the "private" label, header key hints and each row's last-result time.

## Round 2 · agent brief after the owner's feedback

Asked (`.context/workflow-browser-brief-2.md`): the owner chose two columns (W30) with tabs Runs | Details when narrow
and always two columns full screen; grouping runs as a toolbar option; no `⌘K` hint on Run workflow; dispatch in the
command menu, in context (selected workflow → its form; in a repository → its workflows; elsewhere → repository first).
Changed: variants settled, layout-dependent screens redrawn, seven new screens.

- [x] `Workflow / Item head` (`oZJKi`): Run workflow button's key hint (`ZBaFq`) off; `⌘K` gone everywhere. The
  button is built in PR 2.
- [x] `Workflow / Run filters` (`gTzqv`): new `Group: None` control (`z2TR0`) at the end.
- [x] `Workflow / Item · Deploy` (`p8dmLt`): now the narrow item: tabs (`F0wqZ`), head without file path and trigger
  chips (`L2QYq4`), head bottom padding 18 → 16 (`hqyvq`).
- [x] Components · Workflows (`olSuI`): new `Workflow / Group control` (`Bwra9`) and `· open` (`oAVxG`), `Workflow /
  Group option` (`KxlZs`) and `· selected` (`KVUiD`), `Workflow / Group menu` (`H46I6`: None, Status, Ref, Event, Day,
  Actor), `Workflow / Tab · not current` (`m0Rfm4`), `Workflow / Item tabs` (`Av19q`) and `· Details` (`dpsv8`),
  `Workflow / Details · Deploy` (`upAGl`), `Workflow / Item · Deploy · two columns` (`v95xB`, hidden queued #4826 row
  `ruZPm`).
- [x] `Workflow / Details · Deploy` (`upAGl`): the hints "Run workflow… in the command menu" and "Disable workflow in
  the command menu"; `Workflow / Repository chip` (`eosj5`). Built in PR 2, with the commands they name.
- [x] Components · Workflows (`olSuI`): deleted `Workflow / Run row · selected` (`xB8bv`), unused.
- [x] App · Workflows (`IEyTW`): deleted `Variants · How a workflow opens` (`qFSU8`) with W28 (`KCBL9`) and W29
  (`wxTdb`); deleted `Variants · Running a workflow` (`cGeEi`) with W38 (`H59aHh`).
- [x] W30 (`qjQBQ`, slot `e3tf0p`): "Variant C ·" dropped, `W30 · Two columns`; columns now an instance of `v95xB`
  (`HCiUO`); caption rewritten.
- [x] W31 (`wp5Sn`): two columns (`w4yea2`, 1140 px), cursor on #4821.
- [x] W32 (`BRkFo`): narrow item with tabs (`woFoa`, Runs 212), ref filter active.
- [x] W33 (`pbJHk`): narrow item on Details (`eqJc2`, `R3jHPz`, `g2og1U`): CLA, `pull_request` only, no inputs.
- [x] W36 (`cgrai`, slot `O1r5h8`): `W36 · Picking the workflow, in a repository`, background from J1, repository chip
  (`aSPyN`), "⌫ All repositories" hint (`U4U90d`). Built in PR 2.
- [x] W37 (`Tfe0G`, slot `VBQrE`): "Variant A ·" dropped. Built in PR 2.
- [x] W39 (`JlrIz`, slot `z5HXO`): 1920×1080, two columns, #4826 queued, toast moved (`azttK`). Built in PR 2.
- [x] New `W42 · Narrow item, Details tab` (`UH0jD`), `W43 · Runs grouped by status` (`wSULq`, menu open),
  `W44 · Runs grouped by ref` (`rfMFk`), `W45 · Runs grouped by day` (`I6Iyr`).
- [x] New `W46 · Run workflow, picking the repository` (`YhWZy`), `W47 · Run workflow on the selected workflow`
  (`TkD8j`), `W48 · A workflow nobody can dispatch, from the command` (`z8MX76`). Built in PR 2.
- [x] Rows: `hCV6c` W30, W43, W44; `IKwbs` W32, W33, W42, W45; `SwKGt` W31, W34, W35, W47; new `s4vOe` W46, W36, W37,
  W48; `WiYV2` W39, W40, W41.

Agent's guesses in captions, for the owner: the chosen tab stays for the next workflow (W42); grouping is remembered per
workflow (W43).

## Round 3 · agent brief, the navigation model

Asked (`.context/workflow-browser-brief-3.md`): W31 edge to edge with keys at the bottom, W35's header keys and the
captions of W30–W48 in line with `docs/design/githq/navigation.md`. W34 checked, unchanged.
Changed: W31 and W35 only; no component touched.

- [x] W31 (`wp5Sn`): the item (`w4yea2` → `zsvUd`, still an instance of `v95xB`) fills the page between the sidebar and
  the window's edge, 1140 px centred box with side borders → `fill_container`, no stroke; details column keeps 420 px,
  runs take the rest; Columns (`e709i4`) no longer centred.
- [x] W31 (`wp5Sn`): new key bar `Keys` (`QEdqU`) under the columns, copied from W34's: `J K` Run (`ViXuv`), `↵` Open
  run (`LxpRj`), `Esc` Back to the panel (`C18rI8`).
- [x] W31 caption (`F9SxGw`): how full screen is reached (↵ on the open row, ⇧↵ from the panel or the list), why there
  is no centred box, what Esc does.
- [x] W35 (`r5c1Mr`): header hints `↵` Open workflow → Open (`DF37Q`), new `⇧↵` Full screen (`w404Pz`, `Hint / two-icon
  key`) before `F` Latest failure.
- [x] W35 caption (`MpRSm`): ↵ opens the panel, ↵ again or ⇧↵ full screen (W31); the stale reference to W28 gone.

W34 (`J8Gad`) already shows `fitloop/webapp › Deploy › #4825` and `Esc` Back to Deploy. The other captions of W30–W48
describe no Enter or Esc against navigation.md (W37's Esc steps back inside the command menu, which closes first).

Open after round 3: W31 shows both the item's `K` `J` stepper (next workflow) and `J K` Run in the key bar. In the app,
`j`/`k` step to the next item full screen (`item/ItemView.vue`, `item.next`), so W31's runs need a decision.

## Round 4 · agent brief, keys full screen and what the item remembers

Asked (`.context/workflow-browser-brief-4.md`): W31's keys after navigation.md (`j`/`k` walk the runs, `⇧J`/`⇧K` step
to the next workflow), W34 without what D16 leaves out, captions of W35, W42 and W43 after D16, `F` wherever the panel
hints the latest failure.
Changed: W31, W34 and three captions; no component touched. The panel's screens hint the latest failure nowhere except
the Workflows list headers (W35, W47, W48), which already show `F`.

- [x] W31 toolbar (`Hfxsk`): stepper keys `K` `J` (`FCNjO`, `K0EK1S`, `Kbd`) → `⇧K` (`KcBtL`) `⇧J` (`B9fqA`), both
  `Kbd / icon + key` with `arrow-big-up`, replaced inside the instance; `Item / Toolbar` (`I6JTP`) unchanged.
- [x] W31 key bar (`QEdqU`): new `⇧J ⇧K` Workflow (`XcJJC`, `Hint / two keys` with `Kbd / icon + key` keys) after
  `J K` Run, new `F` Latest failure (`er0ja`, `Hint`) after `↵` Open run; order now Run, Workflow, Open run, Latest
  failure, Back to the panel.
- [x] W31 caption (`F9SxGw`): the runs have the keyboard, `J`/`K` walk them, `⇧J`/`⇧K` step to the next workflow (why
  the stepper shows `⇧K` `⇧J`), `F` opens the latest failed run on any ref.
- [x] W34 About this run (`l4D9bX`): Environment (`K6AoEt`) and Artifacts (`T1tGqo`) rows deleted; Started by, Commit,
  Attempt remain.
- [x] W34 heading detail (`IHomv`): "All 7 jobs passed. Deploy shipped 9b07d1e to production; the next run on main
  replaces it." → "All 7 jobs passed."
- [x] W42 caption (`ozJLW`): the tab carries over to the next workflow in the narrow item until the app reloads, then
  starts on Runs.
- [x] W43 caption (`iI0bb`): "remembered per workflow" → one setting for every workflow, saved with the settings and
  synced when saving to GitHub is on; filters clear when another workflow opens.
- [x] W35 caption (`MpRSm`): `F` opens the latest failed run of the workflow under the cursor on whatever ref, does
  nothing with its hint dimmed on a workflow without a failure.

## Round 5 · agent brief, the last result beside the status and readable widths

Asked (`.context/workflow-browser-brief-5.md`): on the Workflows list the last result follows the status instead of
being pinned to the row's right edge, in the component so every screen follows; W34 in a centred box of capped width
with a splitter between the jobs and the summary; W30 and W31 say the edge between the runs and the details is a
splitter. Made in the Pen app through the MCP, not the CLI.
Changed: `Workflow / Row`, `Workflow / Item · Deploy · two columns`, W34 and three captions.

- [x] `Workflow / Row` (`I98wYc`): `Last result` (`riEF4`) moved from the end of the row into `Status cell` (`gstUM`),
  after the status, behind a new `Separator` (`QzGKB`, "·", `$fg-dim`, 11.5); the cell's gap 0 → 6. The time keeps
  `$fg-dim` at 11.5 against the status's 12.5: `$fg-dim` is the dimmest text token that passes contrast (there is no
  `$fg-muted`). Nothing is pinned to the right edge any more. Every screen using the row follows (W2, W2c, W2d,
  W3a–W3c, W13–W15, W17–W19, W21, W30, W32, W33, W35, W39, W41–W45, W47, W48, through the narrow list `i7cCCB` too).
- [x] `Workflow / Row` instances: moving `riEF4` dropped every override on it; all 142 were put back from the base
  (content on 110 rows, hidden on the 12 rows of the narrow list `i7cCCB` and the rows hiding it, shown again in its
  four wider instances `fpPhO`, `I1F4T`, `m1ejIG`, `V9tfK5`). `QzGKB` is hidden wherever the time is hidden or empty.
- [ ] (Reversed by round 8 before it was built; nothing to build.) `Workflow / Item · Deploy · two columns` (`v95xB`):
  `Details column` (`jyqHf`) left border 1 px → none, the edge
  unseen until hovered as between an item's two columns (one `$bg-item` surface); W30, W31 and W39 follow.
- [x] W34 (`J8Gad`): 1440×900 → 1920×1080, so the box shows (at 1440 the pane, 1204 px, is narrower than the box).
  New `Page` (`Xmvs4`, centred) and `Box` (`AW6bB`, 1424 px, vertical) under the toolbar, holding the run's line
  (`iyR9G`) and the columns (`ZEdSN`); the toolbar (`f27hj`) stays full width.
- [x] W34 columns (`ZEdSN`): new `Jobs edge · hovered` (`e38xK`), 2 px `$accent` over the edge between the jobs and
  the summary, the hovered state as CH46 draws it.
- [x] W34 caption (`IMeFt`): the box (1424 px by default, side edges dragged symmetrically from 920 px, kept on this
  device, taking the whole width in a narrower window) and the jobs splitter (200–480 px, 268 by default, kept on this
  device), drawn hovered.
- [x] W31 caption (`F9SxGw`): "The details keep their width" → the edge is a splitter, unseen until hovered, the
  details 320–640 px, 420 by default, kept on this device.
- [x] W30 caption (`q8KyyO`): the edge between the runs and the details is a splitter, 420 px by default, kept on this
  device.

Guesses for the owner: the splitter ranges (jobs 200–480 px, details 320–640 px); whether the run page's box shares
its width with the item page's box or keeps its own (the caption says neither); the jobs edge keeps the column's line
at rest, like the sidebar's and CH46's, while the workflow's two columns, one `$bg-item` surface, draw none.

## Round 6 · agent brief, how a run row reads

Asked (`.context/workflow-browser-brief-6.md`): `Workflow / Run row` (`Y8FSMM`) pins the time and duration to the right
edge, against the rule, and its second line's pieces (number, ref, event, actor) look alike. Two or three variants as
components, each drawn as W31's eight runs (#4822–#4809) at 900 px (the two-column item's runs column) and 560 px (the
narrow item's Runs tab). Made in the Pen app through the MCP, not the CLI.
Changed: new components and one `Variants` frame; `Workflow / Run row` and every screen using it (W30, W31…) unchanged
until the owner picks.

- [x] Components · Workflows › Workflow item (`Lxfnv`): new atoms after `Workflow / Run row`: `Workflow / Run event`
  (`OMB9S`: lucide icon in `$fg-3` and a short word in `$fg-dim`: push `git-commit-horizontal`, PR `git-pull-request`,
  manual `play`, schedule `calendar-clock`), `Workflow / Run actor` (`rpWu3`: 14 px avatar and the login in `$fg-2`),
  `Workflow / Run duration` (`PGg7V`: `timer` icon and the duration in mono `$fg-dim`, amber while running). The ref is
  an instance of `Workflow alerts / Ref` (`J7hppF`), the look of `WorkflowRefChip`; a pull request's run shows its head
  branch with the branch icon, the event says PR.
- [ ] (Superseded: variant deleted in round 7, nothing to build.) `Workflow / Run row · variant A` (`aRcyG`): line 1 state, title (fit to content), `#4821` in mono `$fg-dim` right
  after it; line 2 ref chip, event, actor, duration, age (plain `$fg-dim`), 14 px apart, nothing pinned right; 57 px a
  row.
- [ ] (Superseded: deleted in round 7.) `Workflow / Run row · variant B` (`JpzWZ`, 900 px): one line, state, number, title, then ref chip, event and actor
  as icons only (label and login hidden), duration, age; 37 px a row.
- [ ] (Superseded: deleted in round 7.) `Workflow / Run row · variant B, narrow` (`kMZzn`): number and title, then the same icons-only line 2.
- [x] `Workflow / Run row · variant C` (`y7yiv`): line 1 as A; line 2 starts with the result in words (`Result`
  `ME793`: Running for / Failed after / Passed in / Cancelled after and the duration, the word amber, red, `$fg-2` or
  `$fg-dim`), `·`, the age, then ref chip, event and actor.
- [x] `Workflow / Run row · variant C, narrow` (`hoHPi`): an instance of variant C with the login hidden (avatar only),
  since line 2 does not fit a long ref at 560 px otherwise.
- [x] App · Workflows (`IEyTW`): new `Variants · How a run row reads` (`SPZBF`, amber; settled in round 7 on C) at the end, one row per variant:
  `W49 · Variant A · Number after the title, a second line of distinct pieces` (`tHjyE`, 900 px, recommended), `W50 ·
  Variant A · In the narrow item` (`i90V6v`, 560 px), `W51 · Variant B · One line on a wide column` (`gIGGI`), `W52 ·
  Variant B · Two lines in the narrow item` (`PqOkw`), `W53 · Variant C · The result in words` (`CWenq`), `W54 ·
  Variant C · In the narrow item` (`jsxuT`). Each: the Run filters (copied from W30's), the narrow ones also the Runs |
  Details tabs, eight rows with the cursor on #4821.

Agent's choices the brief left open: the cancelled run #4811 shows a duration (41 s) instead of the word "cancelled",
since the icon says it (C says it in words); the failure on `chore/deploy-workflow` (#4809, `$red-quiet` icon) gets a
`$fg-2` word in C because `$red-quiet` fails contrast as text; B and C swap components below a width (about 760 and
620 px), A has one shape at every width. Not touched: the Run filters' count and Group control still sit at the bar's
right edge.

## Round 7 · agent brief, settle the run row

Asked (`.context/workflow-browser-brief-7.md`): the owner chose Variant C of `Variants · How a run row reads`. Settle
it, make C the run row on every screen, give the cursor row a ref chip that keeps contrast on the selection, and move
the runs toolbar's count and Group control off the right edge.
Changed: the run row and three new variants of it, every screen showing runs, the Run filters, W53 and W54 settled;
A, B and the Variants frame deleted.

- [x] App · Workflows (`IEyTW`): deleted `Variants · How a run row reads` (`SPZBF`) with `W49` (`tHjyE`), `W50`
  (`i90V6v`), `W51` (`gIGGI`), `W52` (`PqOkw`) and their slots. W53 and W54 moved, slots and all, into a new `Row of
  screens` (`WKSWz`) at the end of the frame, no longer amber.
- [x] W53 (`CWenq`, slot `YXGIS`, caption `RFUW7`): `W53 · Variant C · The result in words` → `W53 · The result in
  words`. Caption note (`pu4JE`) rewritten: the run row as settled, the selected chip, the toolbar.
- [x] W54 (`jsxuT`, slot `T5bBV`, caption `WX0wJ`): `W54 · Variant C · In the narrow item` → `W54 · In the narrow
  item`. Caption note (`qDD07`) rewritten around `Workflow / Run row · narrow`.
- [x] Components · Workflows › Workflow item (`Lxfnv`): deleted `Workflow / Run row · variant A` (`aRcyG`), `· variant
  B` (`JpzWZ`), `· variant B, narrow` (`kMZzn`) and `Workflow / Run duration` (`PGg7V`, used only by A and B); deleted
  `· variant C` (`y7yiv`) and `· variant C, narrow` (`hoHPi`) once the run row took their place.
- [x] `Workflow / Run row` (`Y8FSMM`): its tree is now variant C's. Old `Surface` (`vUvjs`) with the title and time on
  line 1 and number, ref, event, actor, spacer and a right-pinned duration on line 2 → new `Surface` (`yvmhP`): line 1
  the title (fit to content) with the number (`hNJbU`) right after it; line 2 `Result` (`aswis`: `Result word`
  `m1Fgab`, `Took` `nWhpP`, `·`, `Age` `ud1K5`), the ref chip (`mB2LY`, `Workflow alerts / Ref`), the event (`Bab4F`,
  `Workflow / Run event`) and the actor (`H2wmdV`, `Workflow / Run actor`). 51 → 57 px a row. Nothing pinned right.
- [x] New `Workflow / Run row · narrow` (`DU9kH`): an instance of the run row with the login hidden (avatar only), for
  rows under about 620 px.
- [x] New `Workflow / Run row · selected` (`cFCw8`): an instance of the run row, the surface `$sel` with the
  `#7B87F74D` 1 px border (the cursor look rows had as overrides), and the ref chip `$bg-3` → `#7B87F726` (the
  selection's border colour, accent, at half its alpha), its icon `$fg-3` → `$fg-2`. The chip label stays `$fg-2`:
  4.62:1 on the chip over the selection; the old chip was 1.03:1 against the selection fill.
- [x] New `Workflow / Run row · narrow, selected` (`xrMld`): an instance of `· selected` with the login hidden.
- [x] Run row data mapped on every instance, same runs and counts: the state icon, title, number and age carried over;
  the old duration became the result word and its duration (`Queued` amber with no duration, `Running for` amber,
  `Failed after` `$red` or `$fg-2` on `$red-quiet` runs, `Passed in` `$fg-2`, `Cancelled` `$fg-dim` with no duration
  where the old row said "cancelled"); the event word became the event atom (`push`, `pull_request` → `PR`,
  `workflow_dispatch` → `manual`); ref, avatar and login carried over.
- [x] `Workflow / Item · Deploy` (`p8dmLt`, 560 px): its 12 rows replaced by `· narrow` instances (new ids `Bg6jq`,
  `On6WU`, `l9fsJV`, `Qxxzc`, `w1pVMq`, `maSB4`, `D3yx1`, `mJ5C3`, `skUN1`, `rig3t`, `VdMma`, `V9OaI`); W41 follows.
- [x] `Workflow / Item · Deploy · two columns` (`v95xB`): its 16 rows stay run row instances, overrides remapped; W30
  follows.
- [x] W31 (`zsvUd`): the cursor row #4821 (`e1lQB`) replaced by a `· selected` instance (`Fgyz1`) instead of fill and
  stroke overrides on the old surface.
- [x] W39 (`aaIw8`): the just-started #4826's amber tint (`ruZPm/vUvjs`) not carried over to the new row: the row is
  the plain run row, as built (corrected in round 12, which dropped the tint).
- [x] W43 (`r1TmY`) and W44 (`hpGvF`): the rows in their replaced run lists (6 and 7) remapped; the rebuild had dropped
  their overrides and they were restored from the base revision's data.
- [x] W32 (`amsQR`): the one row replaced by a `· narrow` instance (`ROmKH`). W45 (`jUfLY`): its 11 rows replaced by
  `· narrow` instances (`AlHFX` … `ZNJlf`).
- [x] W53 (`sgyX9`): eight rows re-pointed from variant C to the run row, the cursor #4821 to `· selected`. W54
  (`lRvfj`): eight rows to `· narrow`, the cursor #4821 to `· narrow, selected`.
- [x] `Workflow / Run filters` (`gTzqv`): `spacer` (`m8G3qJ`, fill_container) → `Divider` (1×14, `$border`), so
  "48 runs · newest first" (`w1mGO`) and the Group control (`z2TR0`) follow the filter chips instead of sitting at the
  right edge. Every screen with the bar follows (W30–W32, W39, W41, W43–W45, W53, W54).

Agent's choices the brief left open: the queued run (#4826, hidden except in W39) says `Queued` with no duration; the
cancelled runs keep no duration, as before, rather than inventing one; the narrow form goes wherever the run list is
560 px (the narrow item, W32, W45), the wide one at 864 px and over; the selected chip tints with the accent rather
than a lighter neutral, since `$border` and `$border-2` keep the label under 4.5:1 unless it turns `$fg`.

## Round 8 · agent brief, the edge between runs and details

Asked (`.context/workflow-browser-brief-8.md`): bring back a visible edge between the runs and the details in `Workflow
/ Item · Deploy · two columns`. Without it the runs column's separators (under the header, under the filter toolbar)
ended in mid-air and the two columns read as one surface. Show the splitter hovered once, and say in W30's and W31's
captions that the edge is a splitter. Made in the Pen app through the MCP, not the CLI.
Changed: one stroke in the component, one hover rectangle in W30, two captions. This reverses round 5's `jyqHf` entry,
still unticked.

- [x] `Workflow / Item · Deploy · two columns` (`v95xB`): `Details column` (`jyqHf`) left border none → 1 px
  `$border`, the token of the runs column's separators (`eRZOb` top, `Workflow / Run filters` bottom). Full height of
  the item body, and the separators end exactly on it (checked at 4×). W30, W31, W39, W43 and W44 follow; none
  overrides the column.
- [x] Separators at the edge: they stop at the line rather than continuing across the details. The details column has
  its own rhythm (a property list from 24 px down, its top level with the workflow head's) and a line through it would
  cut between properties. Nothing changed for this.
- [x] W30 (`qjQBQ`): new `Details edge · hovered` (`S46bs`) in `Workflow view (panel)` (`o9lWKc`), absolute, 2×1006 px
  `$accent` over the edge from below the toolbar to the bottom, the hovered state as W34's `e38xK` draws it.
- [x] W30 caption (`q8KyyO`): the edge is drawn hovered; at rest a 1 px line in the separators' colour, which end on
  it; the details 320–640 px (was only "420 px by default").
- [x] W31 caption (`F9SxGw`): "unseen until hovered as between an item's two columns" → a 1 px line at rest that the
  separators end on, 2 px accent when hovered (W30).

This departs from the design skill's "draw the edge as Direction D does (unseen until hovered)" for this one screen
pair, on the owner's word: the runs column has full-width separators that an item's two columns do not.

## Round 9 · implementation, the design follows the build

Asked (`.context/workflow-browser-brief-9.md`): where the built workflow browser differs from the file in small ways,
bring the drawing in line. No new screen, component or layout; starting runs (W36, W37, W39–W41, W46–W48, the Run
workflow button and the "… in the command menu" hints) left as drawn, except the stepper keys of W39 and W41, which
show the same workflow header. Made through the `pen` CLI. Forced by: the build of PR 1 (browsing), tasks 1–10;
the entries are ticked because each records what the code already does.
Changed: content and visibility only, through overrides or on the component.

- [x] Panel stepper keys, replaced inside each `Item / Toolbar` instance as round 4 did on W31 (`Hfxsk`): `K` `J`
  (`FCNjO`, `K0EK1S`, `Kbd`) → `⇧K` `⇧J` (`Kbd / icon + key`, `arrow-big-up`). W30 `EPw5e` (`FnA85`, `iTDWm`), W43
  `l9xmy` (`iKAEI`, `RF1UK`), W44 `eDmlx` (`vPjNl`, `cwTRF`), W32 `Vai9p` (`W0bgU`, `MAljm`), W33 `e6HCps` (`lrREO`,
  `EcQ5Z`), W42 `Mt9wV` (`WAZF3`, `jfZfI`), W45 `TWI33` (`kJ5vi`, `sJEEW`), W39 `kAiNH` (`TcB2q`, `L9YLz`), and
  `Workflow / Item · Deploy` (`p8dmLt`) toolbar `MX9xp` (`SjoPB`, `hsM45`), which W41 shows. W53 and W54 have no
  toolbar. `Item / Toolbar` (`I6JTP`) unchanged.

- [x] `Workflow / Run filters` (`gTzqv`) count `w1mGO`: "48 runs · newest first" → "48+ runs · newest first". No
  instance overrode it except W32's; W30, W31, W39, W41, W43–W45, W53, W54 follow.

- [x] W32 (`BRkFo`): count `A1TbUJ/w1mGO` "1 of 212 runs" → "1+ run · newest first"; Runs tab `woFoa/bQVLn/Mv9uV`
  "212" → "1"; end sentence `L4sGTZ` "Only runs on sofiab/tokens. Older runs on this ref are read as you scroll." →
  "Reading older runs…".

- [x] W33 Runs tab `eqJc2/bQVLn/Mv9uV`: "186" → "48". W42 (`bn4wM`) already 48; `Av19q`, `dpsv8`, `p8dmLt`, W45 and W54
  carry the component's 48.

- [x] `Workflow / Item · Deploy` (`p8dmLt`) end sentence `rPssQ`: "Older runs load as you scroll" → "Reading older
  runs…", the build's sentence (`WorkflowRuns.loc.yaml`), not in the brief; W41 follows.

- [x] `Workflow / Details · Deploy` (`upAGl`), so the details in `v95xB` (`r6ZkQk`), W30, W31, W39, W42–W44 follow:
  Counts on › main `o09Rr/PtMSM` "Broken for 3h" → "Broken"; › v* hint `f1zuCy/r9JYaP` "Deploy isn't triggered by
  tags" hidden; Typical run hint `I81QkU/r9JYaP` "Median of the last 20 runs" → "Median of the last 20 successful
  runs"; Running hint `O9Nw9/r9JYaP` hidden → shown, "Retry the cache warmup on deploy".

- [x] W33 head (`dKOuN`): pill icon `XhxQI` `git-pull-request` → `circle-dashed`, label `iMTJQ` "Pull requests only" →
  "No verdict yet" (the pill was already the build's muted look, `$fg-2` on `$bg-3`); sentence `CsX98` "never counts ·
  1 of the last 5 failed" hidden.

- [x] W33 details (`g2og1U`): pull_request `DpGhK/PtMSM` "opened, synchronize" → "any pull request", `DpGhK/r9JYaP`
  "GitHub starts it on pull requests. The file has no workflow_dispatch, …" → "Never counts"; main `o09Rr/PtMSM`
  "Never counts" → "No runs on a branch yet", `o09Rr/r9JYaP` hidden (icon already `circle-dashed`).

- [x] W33 caption (`w9mQi`): the head reads "No verdict yet" while no counted ref has a run, with no sentence; the
  trigger and main as above. Title `W33 · A workflow without workflow_dispatch` unchanged.

- [x] W31 caption (`F9SxGw`): Esc's hint reads "Back to the panel" from the panel, "Back to the list" when reached
  straight from the list (⇧↵); details "420 by default" → "400 by default".

- [x] W30 caption (`q8KyyO`): details "420 by default" → "400 by default".

- [x] W34 key bar (`f8Y0u`): Job hint `FqYnY` keys `J` `K` → `⌥J` (`fBSOZ`) `⌥K` (`vJKy0`), `Kbd / icon + key` with
  `option`; `? All keys` (`N2P7qq`) deleted. `↵` Open log, `Esc` Back to Deploy, `O` GitHub (the letter) unchanged.

- [x] W34 Jobs over time head (`vGFIu`): the "0s" axis label (`nHG4E`) deleted.

- [x] W34 caption (`IMeFt`): the box is one setting with the item page's box; the key bar shows only at the overview,
  the log's own toolbar takes over once a job's log is open.

- [x] Left open, then drawn in round 10: in W32 the longer count pushes the Run filters' `Group: None` control
  (`A1TbUJ/z2TR0`) 31 px past the 560 px bar. The build wraps the bar (`flex-wrap: wrap`).

Still unticked after this round, all of them built in PR 2 (starting runs): W36, W37, W39, W40, W41, W46, W47, W48, the
Run workflow button's hint, `Workflow / Command step`, `Workflow / Dispatch field`, `Workflow / Repository chip` and the
"… in the command menu" hints in Details. Unticked and explained, with nothing to build: round 5's `jyqHf` entry
(reversed by round 8) and round 6's variants A and B (deleted in round 7).

## Round 10 · implementation, the head of a pull-request-only workflow and the narrow filter bar

Asked (`.context/workflow-browser-brief-10.md`): two places where the build settled differently from round 9. Made in
the Pen app through the MCP. Forced by: the build of PR 1 (browsing). `WorkflowView` now says what the Workflows list
says for a workflow only pull requests ran (story `WorkflowView` › `NarrowDetails`); the runs' toolbar in
`WorkflowRuns.vue` wraps, and round 9 left W32 31 px too wide. The entries are ticked because each records what the
code does.

- [x] W33 head (`dKOuN`): reverses round 9's pill. Icon `XhxQI` `circle-dashed` → `git-pull-request`, label `iMTJQ`
  "No verdict yet" → "Pull requests only" (still muted, `$fg-2` on `$bg-3`), sentence `CsX98` hidden → shown, "never
  counts · 1 of the last 5 failed" → "never counts". Round 9's details changes stay.
- [x] W33 caption (`w9mQi`): the head says what the Workflows list says: "Pull requests only", muted with a
  pull-request icon, then "never counts". The rest as round 9 left it.
- [x] `Workflow / Run filters` (`gTzqv`): its children grouped, without a visible change on a wide screen: the chips
  (`o2YrjP`, `V2bcUx`, `u6dTf`, `lEx9u`, `F7glA`) into `Filters` (`vUVTv`), and Divider `m8G3qJ`, Count `w1mGO` and
  Group `z2TR0` into `Count and grouping` (`aDZxw`), both horizontal with the bar's 6 px gap and centred. Ids kept, so
  the instances' overrides still apply. W30, W31, W39, W41's wide parts, W43, W44, W53 and `Workflow item` (`sJEQe`)
  read as before.
- [x] New `Workflow / Run filters · narrow` (`RPP7b`), next to the base in `Workflow item` (`Lxfnv`): an instance of
  `gTzqv`, vertical with 8 px between the lines, left aligned, the divider hidden. The chips on the first line, the count
  and `Group: …` on the second under them. Used wherever the runs are 560 px wide.
- [x] Instances swapped to the narrow variant, overrides carried over (new ids, as an instance can't change its
  component): `Workflow / Item · Deploy` (`p8dmLt`) `K3M99s` → `Y2VY5`, so W41 follows; W32 `A1TbUJ` → `iewHR`
  (Filter active shown, Ref hidden, "1+ run · newest first"); W45 `EnJFz` → `pSG30` ("Group: Day"); W54 `w0R1fM` →
  `uXgr2` (its own 24 px side padding kept). W54 was not in the brief: it is the same narrow item, and its single line
  ran 4 px into the bar's padding.

The narrow bar hides the divider, since the line break already separates the chips from the count. `WorkflowRuns.vue`
keeps the count and Group in one element, so they wrap together onto the second line, as drawn.

## Round 11 · implementation, starting runs follows the build

Asked (`.context/workflow-browser-brief-11.md`): starting runs is built (PR 2, tasks 12–16: `CommandForm.vue`,
`CommandCrumbs.vue`, `CommandMenu.vue`, `useRunWorkflowCommand.ts`, `WorkflowDispatchToast.vue`, the commands in
`WorkflowRunView.vue` and `OpenedWorkflow.vue`, the hints in `WorkflowDetails.vue`); bring the drawing in line where it
was built differently in small ways. Made through the `pen` CLI. Forced by: the build of PR 2. The entries of rounds 1
and 2 left with "Built in PR 2" are ticked above; these are ticked because each records what the code does.
Changed: content and visibility through overrides or on the component; hints, headings and an arrow added as instances
of the ones beside them. W39 (`JlrIz`) already matched the build (toast "Deploy started on main · #4826", the inputs,
"Queued on GitHub.", Open ⌥O; Run workflow… without a key hint; the Details hints) and is unchanged.

- [x] `Workflow / Command step` (`W4hVe`): ▷ icon `FXqwp` shown → hidden; every "Run workflow" crumb follows (`iNUyC`,
  `NsWdk`, `n10Otc`; `UgPYO` already hid it).
- [x] `Workflow / Repository chip` (`eosj5`): lock `bQdjF` and × `a3cM7` hidden: a plain crumb, ⌫ (or ←) steps back to
  all repositories.
- [x] W46 (`YhWZy`): placeholder `rcVzr` "Pick a repository…" → "Type a command or search…"; headings `G80zw` "Tracked
  repositories" and `K6P7S` "Nothing to run" hidden; repository icons `z7iSD` lock → `book-marked`; details `MXfcN`
  folded with the names (`xNCFw` "3 workflows you can run · Deploy, Release, Nightly e2e", `Y6ErG` "1 workflow you can
  run · Deploy", `nBawu` "1 workflow you can run · Deploy preview"), the right-hand names `IxzB4` hidden; mdlint
  `FofHT/IxzB4` "" → "can't run" (the row was already dimmed as W48's). Footer: `LltgL` "Choose" → "Run", new `PA7pm`
  → Open submenu, `xxkD0` ← Back, `e838Nd` Esc Close; "Run workflow · step 1 of 3" `wAZs8` hidden.
- [x] W36 (`cgrai`): new arrow `HFBbv` (copy of W37's `aKV7v`) between `NsWdk` and the repository chip `aSPyN`;
  placeholder `gP7Nm` "Pick a workflow…" → "Type a command or search…"; heading `fCfmV` hidden; rows `VAVKC`, `n0ASDU`,
  `veQKw`: status icon → `play` (its colour override dropped, `$fg-2` as the component), detail "Broken on main" /
  "Broken on main" / "failing, no alerts" → "main · 3 inputs" / "main · 1 input" / "main · no inputs", the right-hand
  `IxzB4` hidden. Footer: `ACVL5` "Choose" → "Run", new `YwomG` → Open submenu, `U4U90d` ⌫ "All repositories" → ←
  "Back", new `mRlsO` Esc Close; note `hAU0l` "Only workflows with workflow_dispatch · 3 of 8" hidden.
- [x] W37 (`Tfe0G`): the `⌘↵ Run` hint `MHEqj` deleted, in its place `sAnyn`, an instance of `Button / label, icon key`
  (`vAXUD`, the quiet button "Re-run ⇧E" uses) reading "Run ⌘↵": the build's clickable ghost button. The footer grew a
  few px with it.
- [x] W47 (`TkD8j`) and W48 (`z8MX76`): heading `n01rz` / `DYhrh` "Commands" → "This view"; new "App" headings `nZqar`
  / `u8YnIH` over "Run workflow…". W47 `N21cs` detail "the selected workflow — main · 3 inputs", right-hand text
  hidden; `XDjCY` / `V07KCN` detail "a workflow in fitloop/webapp · 3 can run", right-hand "3 can run" hidden. Footers:
  `HhUvL` / `l7SSnT` "Choose" → "Run", new `lZrls` / `Bcs0w` → Open submenu and `sSbDG` / `b9Osi` > Commands only;
  notes `E2i67` "Enter opens Deploy's form" / `jkREd` "Enter picks another workflow" hidden. W48's CLA row (reason as
  detail, "can't run" aside) already matched.
- [x] W40 (`vyJvT`): heading `k3rGuq` "This run" → "This view"; "Open workflow · Deploy" `Uh3QA` moved from "Go to" to
  after "Copy link to the run"; "Go to" keeps "Broken workflows", the app's existing place.
- [x] W41 (`Ehh4p`): heading `y2vnO` "This workflow" → "This view"; `atIpD` "Run workflow…" · "on main, 3 inputs" →
  "Run workflow · Deploy" · "the open workflow — main · 3 inputs".
- [x] Captions W36 `P7pzk`, W46 `wDk8I`, W37 `Vv2I7`, W47 `pdEqw`, W48 `eGpI8`, W40 `i8Q8K`, W41 `EOMe5`: say how the
  build reads (no headings inside Run workflow's levels, a › between plain crumbs, ← or ⌫ steps back, "This view" and
  "App", the "can't run" aside, the Run button). W37's adds: when the workflow can't run at the ref typed, a line under
  the fields says why and the ref stays editable.

Left as drawn, for the owner:

- W37's "can't run at this ref" state (the line under the fields) is described in the caption, not drawn: it would be a
  new screen.
- The top-level menu's subject or repository chip and "⌫ Remove context" in W47/W48, and the generic footer of W40/W41
  ("Type > for commands only" against the build's `> Commands only` hint): the menu as a whole, not this feature.
- The command menu's levels show the generic placeholder "Type a command or search…" (drawn so); "Pick a repository…" /
  "Pick a workflow…" were clearer, a candidate change to the build rather than the drawing.

## Round 12 · implementation, the just-started run without a tint

Asked (`.context/workflow-browser-brief-12.md`): the owner's answer to round 11's open W39 point: drop the tint. The
build puts the just-started run at the top of the runs (`WorkflowRunHistory.addRun`) as a plain queued row, "Queued" in
the run row's result. Made through the Pen MCP. Forced by: the build of PR 2. Ticked because it records what the code
does. Round 7's unticked `aaIw8` entry is corrected above.

- [x] W39 (`JlrIz`): the workflow item `aaIw8` replaced by `ApQ6Z`, the same `Workflow / Item · Deploy · two columns`
  instance showing `Run #4826` (`ruZPm`) with no fill override on its surface (`ruZPm/yvmhP` `#D299220F` → none): it
  reads as the other run rows. Caption `M92RyW` unchanged: it never mentioned the highlight.

## Round 13 · implementation, Run workflow's levels get their headings, notes and placeholders back

Asked (`.context/workflow-browser-brief-13.md`, follow-up `.context/workflow-browser-brief-14.md`): the command menu's
levels can now carry what round 11 hid to match the first build: a heading per group of a level's rows
(`Command.group`), the level's own placeholder (`Command.placeholder`), a quiet note at the footer's end while a level
is open (`Command.levelHint`) or while a line is highlighted (`Command.hint`), and the ▷ icon on the crumb of an action
whose levels are walked into (`CommandMenu.vue`, `useRunWorkflowCommand.ts`). Made through the `pen` CLI. Forced by: the
build. Ticked because each records what the code does. Round 11's "left as drawn" point on the placeholders is settled
by the build.

- [x] `Workflow / Command step` (`W4hVe`): ▷ icon `FXqwp` hidden → shown; the "Run workflow" crumbs in W46, W36 and W37
  (`iNUyC`, `NsWdk`, `n10Otc`) show it; `UgPYO` (W37's "Deploy" crumb) keeps it hidden.

- [x] W46 (`YhWZy`): headings `G80zw` "Tracked repositories" and `K6P7S` "Nothing to run" shown; placeholder `rcVzr` "Type
  a command or search…" → "Pick a repository…"; footer note `wAZs8` "Run workflow · step 1 of 3" shown at the end.

- [x] W36 (`cgrai`): heading `fCfmV` shown, "Workflows in fitloop/webapp you can run"; placeholder `gP7Nm` "Type a command
  or search…" → "Pick a workflow…"; footer note `hAU0l` "Only workflows with workflow_dispatch · 3 of 8" shown, on a
  line of its own at the footer's right end, under the hints: it doesn't fit beside them, and the build's footer
  (`FilterList.vue`) wraps an end note that doesn't fit to its own line rather than breaking the hints. The footer
  `DGmJy` stacks two lines 4 px apart, its padding unchanged: the hints in a new row `Hints` (`cshiA`, the same 14 px
  gap), the spacer `G8kkxh` moved into it and still hidden, the note on one line at the right. The count is of the
  repository's enabled workflows (`useDispatchableWorkflows`).

- [x] W47 (`TkD8j`): note `E2i67` "Enter opens Deploy's form" shown, while "Run workflow · Deploy" is highlighted.

- [x] Captions W46 `wDk8I`, W36 `P7pzk`, W47 `pdEqw`, W37 `Vv2I7`: the headings, placeholders, footer notes and the ▷;
  round 11's "no headings inside the levels" wording removed; W36's adds that a note that doesn't fit takes its own line.

- [x] W48 (`z8MX76`, brief `.context/workflow-browser-brief-15.md`): note `jkREd` "Enter picks another workflow" shown at
  the footer's end. The build shows the hint of a listed line that can't run ("Run workflow · CLA") while the line the
  cursor skipped to ("Run workflow…") has none of its own. Caption `eGpI8` says so.
