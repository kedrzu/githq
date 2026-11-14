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
