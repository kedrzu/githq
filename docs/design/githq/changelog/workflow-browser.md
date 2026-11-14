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

- [ ] Components · Workflows (`olSuI`): new group `Workflow item` (`Lxfnv`) with `Workflow / Run row` (`Y8FSMM`), its
  `· selected` state (`xB8bv`), `Workflow / Item head` (`oZJKi`), `Workflow / Trigger` (`G2ST7p`), `Workflow / Run
  filters` (`gTzqv`), `Workflow / Filter chip · active` (`L2hg3T`), `Workflow / Item · Deploy` (`p8dmLt`), `Workflow /
  List pane · narrow` (`i7cCCB`), `Workflow / Ref group` (`BtLBS`), `Workflow / Property` (`csWLC`), `Workflow / Command
  step` (`W4hVe`), `Workflow / Dispatch field` (`yQX5u`) and its `· focused` state (`bnUx8`).
- [ ] App · Workflows (`IEyTW`): new `Variants · How a workflow opens` (`qFSU8`): `W28 · Variant A · Header and a flat
  run list` (`KCBL9`, recommended), `W29 · Variant B · Runs grouped by ref` (`wxTdb`), `W30 · Variant C · Two columns`
  (`qjQBQ`, 1920×1080 so the panel is 1300 px).
- [ ] App · Workflows (`IEyTW`): new `W31 · Workflow full screen` (`wp5Sn`), `W32 · A passing workflow` (`BRkFo`), `W33 ·
  A workflow without workflow_dispatch` (`pbJHk`), `W34 · A passing run, opened at its summary` (`J8Gad`), `W35 · The
  Workflows list with the new keys` (`r5c1Mr`: ↵ Open workflow, F Latest failure).
- [ ] App · Workflows (`IEyTW`): new `Variants · Running a workflow` (`cGeEi`): `W36 · Variant A · Picking the workflow,
  in the command menu` (`cgrai`), `W37 · Variant A · The form, filled, in the command menu` (`Tfe0G`), `W38 · Variant B ·
  A dialog` (`H59aHh`).
- [ ] App · Workflows (`IEyTW`): new `W39 · After starting` (`JlrIz`), `W40 · Commands on a run` (`vyJvT`), `W41 ·
  Commands on a workflow` (`Ehh4p`).

Choices the brief left open, made by the agent: run rows on two lines in the panel (one line left ~70 px for the
title); the header's "Runs on" label hidden so three trigger chips fit; Variant B's `v*` group says "No runs on a tag
yet"; the narrow list hides the "private" label, header key hints and each row's last-result time.

## Round 2 · agent brief after the owner's feedback

Asked (`.context/workflow-browser-brief-2.md`): the owner chose two columns (W30) with tabs Runs | Details when narrow
and always two columns full screen; grouping runs as a toolbar option; no `⌘K` hint on Run workflow; dispatch in the
command menu, in context (selected workflow → its form; in a repository → its workflows; elsewhere → repository first).
Changed: variants settled, layout-dependent screens redrawn, seven new screens.

- [ ] `Workflow / Item head` (`oZJKi`): Run workflow button's key hint (`ZBaFq`) off; `⌘K` gone everywhere.
- [ ] `Workflow / Run filters` (`gTzqv`): new `Group: None` control (`z2TR0`) at the end.
- [ ] `Workflow / Item · Deploy` (`p8dmLt`): now the narrow item: tabs (`F0wqZ`), head without file path and trigger
  chips (`L2QYq4`), head bottom padding 18 → 16 (`hqyvq`).
- [ ] Components · Workflows (`olSuI`): new `Workflow / Group control` (`Bwra9`) and `· open` (`oAVxG`), `Workflow /
  Group option` (`KxlZs`) and `· selected` (`KVUiD`), `Workflow / Group menu` (`H46I6`: None, Status, Ref, Event, Day,
  Actor), `Workflow / Tab · not current` (`m0Rfm4`), `Workflow / Item tabs` (`Av19q`) and `· Details` (`dpsv8`),
  `Workflow / Details · Deploy` (`upAGl`, hints say "in the command menu"), `Workflow / Item · Deploy · two columns`
  (`v95xB`, hidden queued #4826 row `ruZPm`), `Workflow / Repository chip` (`eosj5`).
- [ ] Components · Workflows (`olSuI`): deleted `Workflow / Run row · selected` (`xB8bv`), unused.
- [ ] App · Workflows (`IEyTW`): deleted `Variants · How a workflow opens` (`qFSU8`) with W28 (`KCBL9`) and W29
  (`wxTdb`); deleted `Variants · Running a workflow` (`cGeEi`) with W38 (`H59aHh`).
- [ ] W30 (`qjQBQ`, slot `e3tf0p`): "Variant C ·" dropped, `W30 · Two columns`; columns now an instance of `v95xB`
  (`HCiUO`); caption rewritten.
- [ ] W31 (`wp5Sn`): two columns (`w4yea2`, 1140 px), cursor on #4821.
- [ ] W32 (`BRkFo`): narrow item with tabs (`woFoa`, Runs 212), ref filter active.
- [ ] W33 (`pbJHk`): narrow item on Details (`eqJc2`, `R3jHPz`, `g2og1U`): CLA, `pull_request` only, no inputs.
- [ ] W36 (`cgrai`, slot `O1r5h8`): `W36 · Picking the workflow, in a repository`, background from J1, repository chip
  (`aSPyN`), "⌫ All repositories" hint (`U4U90d`).
- [ ] W37 (`Tfe0G`, slot `VBQrE`): "Variant A ·" dropped.
- [ ] W39 (`JlrIz`, slot `z5HXO`): 1920×1080, two columns, #4826 queued, toast moved (`azttK`).
- [ ] New `W42 · Narrow item, Details tab` (`UH0jD`), `W43 · Runs grouped by status` (`wSULq`, menu open),
  `W44 · Runs grouped by ref` (`rfMFk`), `W45 · Runs grouped by day` (`I6Iyr`), `W46 · Run workflow, picking the
  repository` (`YhWZy`), `W47 · Run workflow on the selected workflow` (`TkD8j`), `W48 · A workflow nobody can dispatch,
  from the command` (`z8MX76`).
- [ ] Rows: `hCV6c` W30, W43, W44; `IKwbs` W32, W33, W42, W45; `SwKGt` W31, W34, W35, W47; new `s4vOe` W46, W36, W37,
  W48; `WiYV2` W39, W40, W41.

Agent's guesses in captions, for the owner: the chosen tab stays for the next workflow (W42); grouping is remembered per
workflow (W43).

## Round 3 · agent brief, the navigation model

Asked (`.context/workflow-browser-brief-3.md`): W31 edge to edge with keys at the bottom, W35's header keys and the
captions of W30–W48 in line with `docs/design/githq/navigation.md`. W34 checked, unchanged.
Changed: W31 and W35 only; no component touched.

- [ ] W31 (`wp5Sn`): the item (`w4yea2` → `zsvUd`, still an instance of `v95xB`) fills the page between the sidebar and
  the window's edge, 1140 px centred box with side borders → `fill_container`, no stroke; details column keeps 420 px,
  runs take the rest; Columns (`e709i4`) no longer centred.
- [ ] W31 (`wp5Sn`): new key bar `Keys` (`QEdqU`) under the columns, copied from W34's: `J K` Run (`ViXuv`), `↵` Open
  run (`LxpRj`), `Esc` Back to the panel (`C18rI8`).
- [ ] W31 caption (`F9SxGw`): how full screen is reached (↵ on the open row, ⇧↵ from the panel or the list), why there
  is no centred box, what Esc does.
- [ ] W35 (`r5c1Mr`): header hints `↵` Open workflow → Open (`DF37Q`), new `⇧↵` Full screen (`w404Pz`, `Hint / two-icon
  key`) before `F` Latest failure.
- [ ] W35 caption (`MpRSm`): ↵ opens the panel, ↵ again or ⇧↵ full screen (W31); the stale reference to W28 gone.

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

- [ ] W31 toolbar (`Hfxsk`): stepper keys `K` `J` (`FCNjO`, `K0EK1S`, `Kbd`) → `⇧K` (`KcBtL`) `⇧J` (`B9fqA`), both
  `Kbd / icon + key` with `arrow-big-up`, replaced inside the instance; `Item / Toolbar` (`I6JTP`) unchanged.
- [ ] W31 key bar (`QEdqU`): new `⇧J ⇧K` Workflow (`XcJJC`, `Hint / two keys` with `Kbd / icon + key` keys) after
  `J K` Run, new `F` Latest failure (`er0ja`, `Hint`) after `↵` Open run; order now Run, Workflow, Open run, Latest
  failure, Back to the panel.
- [ ] W31 caption (`F9SxGw`): the runs have the keyboard, `J`/`K` walk them, `⇧J`/`⇧K` step to the next workflow (why
  the stepper shows `⇧K` `⇧J`), `F` opens the latest failed run on any ref.
- [ ] W34 About this run (`l4D9bX`): Environment (`K6AoEt`) and Artifacts (`T1tGqo`) rows deleted; Started by, Commit,
  Attempt remain.
- [ ] W34 heading detail (`IHomv`): "All 7 jobs passed. Deploy shipped 9b07d1e to production; the next run on main
  replaces it." → "All 7 jobs passed."
- [ ] W42 caption (`ozJLW`): the tab carries over to the next workflow in the narrow item until the app reloads, then
  starts on Runs.
- [ ] W43 caption (`iI0bb`): "remembered per workflow" → one setting for every workflow, saved with the settings and
  synced when saving to GitHub is on; filters clear when another workflow opens.
- [ ] W35 caption (`MpRSm`): `F` opens the latest failed run of the workflow under the cursor on whatever ref, does
  nothing with its hint dimmed on a workflow without a failure.

## Round 5 · agent brief, the last result beside the status and readable widths

Asked (`.context/workflow-browser-brief-5.md`): on the Workflows list the last result follows the status instead of
being pinned to the row's right edge, in the component so every screen follows; W34 in a centred box of capped width
with a splitter between the jobs and the summary; W30 and W31 say the edge between the runs and the details is a
splitter. Made in the Pen app through the MCP, not the CLI.
Changed: `Workflow / Row`, `Workflow / Item · Deploy · two columns`, W34 and three captions.

- [ ] `Workflow / Row` (`I98wYc`): `Last result` (`riEF4`) moved from the end of the row into `Status cell` (`gstUM`),
  after the status, behind a new `Separator` (`QzGKB`, "·", `$fg-dim`, 11.5); the cell's gap 0 → 6. The time keeps
  `$fg-dim` at 11.5 against the status's 12.5: `$fg-dim` is the dimmest text token that passes contrast (there is no
  `$fg-muted`). Nothing is pinned to the right edge any more. Every screen using the row follows (W2, W2c, W2d,
  W3a–W3c, W13–W15, W17–W19, W21, W30, W32, W33, W35, W39, W41–W45, W47, W48, through the narrow list `i7cCCB` too).
- [ ] `Workflow / Row` instances: moving `riEF4` dropped every override on it; all 142 were put back from the base
  (content on 110 rows, hidden on the 12 rows of the narrow list `i7cCCB` and the rows hiding it, shown again in its
  four wider instances `fpPhO`, `I1F4T`, `m1ejIG`, `V9tfK5`). `QzGKB` is hidden wherever the time is hidden or empty.
- [ ] `Workflow / Item · Deploy · two columns` (`v95xB`): `Details column` (`jyqHf`) left border 1 px → none, the edge
  unseen until hovered as between an item's two columns (one `$bg-item` surface); W30, W31 and W39 follow.
- [ ] W34 (`J8Gad`): 1440×900 → 1920×1080, so the box shows (at 1440 the pane, 1204 px, is narrower than the box).
  New `Page` (`Xmvs4`, centred) and `Box` (`AW6bB`, 1424 px, vertical) under the toolbar, holding the run's line
  (`iyR9G`) and the columns (`ZEdSN`); the toolbar (`f27hj`) stays full width.
- [ ] W34 columns (`ZEdSN`): new `Jobs edge · hovered` (`e38xK`), 2 px `$accent` over the edge between the jobs and
  the summary, the hovered state as CH46 draws it.
- [ ] W34 caption (`IMeFt`): the box (1424 px by default, side edges dragged symmetrically from 920 px, kept on this
  device, taking the whole width in a narrower window) and the jobs splitter (200–480 px, 268 by default, kept on this
  device), drawn hovered.
- [ ] W31 caption (`F9SxGw`): "The details keep their width" → the edge is a splitter, unseen until hovered, the
  details 320–640 px, 420 by default, kept on this device.
- [ ] W30 caption (`q8KyyO`): the edge between the runs and the details is a splitter, 420 px by default, kept on this
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

- [ ] Components · Workflows › Workflow item (`Lxfnv`): new atoms after `Workflow / Run row`: `Workflow / Run event`
  (`OMB9S`: lucide icon in `$fg-3` and a short word in `$fg-dim`: push `git-commit-horizontal`, PR `git-pull-request`,
  manual `play`, schedule `calendar-clock`), `Workflow / Run actor` (`rpWu3`: 14 px avatar and the login in `$fg-2`),
  `Workflow / Run duration` (`PGg7V`: `timer` icon and the duration in mono `$fg-dim`, amber while running). The ref is
  an instance of `Workflow alerts / Ref` (`J7hppF`), the look of `WorkflowRefChip`; a pull request's run shows its head
  branch with the branch icon, the event says PR.
- [ ] `Workflow / Run row · variant A` (`aRcyG`): line 1 state, title (fit to content), `#4821` in mono `$fg-dim` right
  after it; line 2 ref chip, event, actor, duration, age (plain `$fg-dim`), 14 px apart, nothing pinned right; 57 px a
  row.
- [ ] `Workflow / Run row · variant B` (`JpzWZ`, 900 px): one line, state, number, title, then ref chip, event and actor
  as icons only (label and login hidden), duration, age; 37 px a row.
- [ ] `Workflow / Run row · variant B, narrow` (`kMZzn`): number and title, then the same icons-only line 2.
- [ ] `Workflow / Run row · variant C` (`y7yiv`): line 1 as A; line 2 starts with the result in words (`Result`
  `ME793`: Running for / Failed after / Passed in / Cancelled after and the duration, the word amber, red, `$fg-2` or
  `$fg-dim`), `·`, the age, then ref chip, event and actor.
- [ ] `Workflow / Run row · variant C, narrow` (`hoHPi`): an instance of variant C with the login hidden (avatar only),
  since line 2 does not fit a long ref at 560 px otherwise.
- [ ] App · Workflows (`IEyTW`): new `Variants · How a run row reads` (`SPZBF`, amber) at the end, one row per variant:
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
