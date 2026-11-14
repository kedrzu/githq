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
