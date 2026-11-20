# Reorder tracked repositories and projects

The user orders their tracked projects and repositories by dragging them in the sidebar, each kind among its own.
Settings → Repositories (G8) and Projects (T17) list them flat in that same order instead of grouped by owner, with
dragging and ⌥↑ ⌥↓ on the selected row (D44). A dragged row moves live, as in any sortable list, so dragging needs no
drawing. Base: `a24e75ef`.

## Round 1 · agent brief

Asked (`.context/reorder-tracked-brief.md`): the sidebar while a repository is dragged, G8 and T17 flat in the user's
order with the owner in grey before the name and a ⌥↑ ⌥↓ hint, and Settings while a row is dragged.
Changed: G8 and T17 redrawn, three row/head components extended. (Round 1 also drew T26 and T27, dragging with a drop
line, and a `Drop line` component; round 2 removed them unbuilt, and their entries with them.)

- [ ] Settings / Tracked repository row (`CqvD4`): the name sits in a new frame `Name` (`mRGB7`) after a grey owner
      prefix `Owner` (`Hwy5K`, `$fg-dim`, "mlaine/"); the selected variant (`Dht0d`) inherits it.
- [ ] Settings / Tracked project row (`L5sxR`): grey `Owner` (`UPlz7`, "mlaine /") before the title.
- [ ] Settings / Tracked list head (`QpXtY`): new `Move hint` (`KkzVQ`): keys ⌥↑ (`FqePR`) ⌥↓ (`fkgg1`) and "Move"
      (`Owtyz`), before "Track repositories A".
- [ ] G8 (`sUokO`): owner group headers `ZaIOI`, `l54WU`, `UTDPc` removed; 15 rows flat in the sidebar's order;
      caption (`bx80b`) rewritten.
- [ ] T17 (`vmn2a`): owner group headers `T9agL`, `SG3nx` removed; rows flat in the sidebar's order; caption (`UoNwD`)
      rewritten.
- [ ] T18, T22: still grouped by owner; the new owner prefix and the hint hidden on their instances so they look as
      before. (T20 and the docs figures DOC2, DOC4 were redrawn flat in round 2.)

## Round 2 · agent brief

Asked (`.context/reorder-tracked-brief-2.md`), from the owner's feedback: a dragged row moves itself, live, so no drop
line and no drawing of dragging; Settings has no owner filter (D25), only the pickers (T18, T22) filter by owner and
stay grouped; T20 and the docs figures flat like G8.
Changed: T26, T27 and `Drop line` deleted, the frames below App · Settings back up 1021 px, G8's owner column removed,
T20 and DOC2/DOC4 figures flat. T17 already had no owner column; T18 and T22 untouched.

- [ ] App · Settings (`i3VkT`): row `bVETM` deleted with T26 (`ziv4q`) and T27 (`e3OAg`); its bottom 94049 → 93028.
- [ ] Drop line (`gvZcM`): component deleted (its only instances were in T26, T27).
- [ ] Top-level frames moved up 1021 px, back to where they were before round 1, 1200 px below App · Settings:
      `rV6qN`, `ohwJa`, `Ri8IR`, `jy6bO` (y 95249 → 94228); `JJOFX`, `ucqck`, `XCfAD`, `jv9Tp`, `ykYxo`, `I5wWZ`,
      `S5J7kt`, `nCTdq`, `PiKGF` (y 137544 → 136523).
- [ ] G8 (`sUokO`): owner filter column `Owners` (`yFFiZ`, with "Missing an organisation?") deleted; Body (`g9v7g`)
      horizontal → vertical, gap 24 → 16, as in T20, so the list spans the content area; caption (`bx80b`): the
      filter, Grant access and T27 sentences removed, "no owner filter here: only the picker (T18) filters by owner"
      and "drag a row and it moves as you drag" added.
- [ ] T20 (`GlcNe`): owner headers `bOcXQ`, `w5emu`, `xzWPK` and the 14 grouped rows deleted; 14 rows flat in G8's order
      without fitloop/api (`PtqAR`, `I22g9`, `IGjSY`, `yt0jg`, `WB9GW`, `hZcwA`, `eZUui`, `Cds1f`, `fg8gS`, `NLQ31`,
      `nYjwx`, `W7xxb`, `Y03Ay`, `rYF9G`), owner prefix shown; the selected row is mlaine/notes (`yt0jg`), the one
      after the untracked fitloop/api, as the caption says; List head (`ZYeux`) shows the ⌥↑ ⌥↓ Move hint.
- [ ] DOC2 (`QfYGH`) figure `NQtyN`: owner header `r4s5j` deleted; rows `fcyT4`, `thC2M`, `sNcx9`, `Zni9k`, `M10U1`
      show the owner prefix; head `Irvpl` shows the hint; caption (`fEjni`) "grouped by owner" → "in your order".
- [ ] DOC4 (`hecic`) figure `tTfAW`: owner header `aV3Ji` deleted; rows `zjubD`, `wU0Pi`, `PLcqF`, `w0V7g`, `ff2w8`
      show the owner prefix; head `UnHck` shows the hint; caption (`U1aly`) "grouped by owner" → "in your order".
