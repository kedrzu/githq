# Reorder tracked repositories and projects

The user orders their tracked projects and repositories by dragging them in the sidebar, each kind among its own.
Settings → Repositories (G8) and Projects (T17) list them flat in that same order instead of grouped by owner, with
dragging and ⌥↑ ⌥↓ on the selected row (D44). Base: `a24e75ef`.

## Round 1 · agent brief

Asked (`.context/reorder-tracked-brief.md`): the sidebar while a repository is dragged, G8 and T17 flat in the user's
order with the owner in grey before the name and a ⌥↑ ⌥↓ hint, and Settings while a row is dragged.
Changed: two new screens in a new row of App · Settings, G8 and T17 redrawn, three row/head components extended, one
new component. The frames below App · Settings moved down 1021 px to keep 1200 px between rows.

- [ ] Settings / Tracked repository row (`CqvD4`): the name sits in a new frame `Name` (`mRGB7`) after a grey owner
      prefix `Owner` (`Hwy5K`, `$fg-dim`, "mlaine/"); the selected variant (`Dht0d`) inherits it.
- [ ] Settings / Tracked project row (`L5sxR`): grey `Owner` (`UPlz7`, "mlaine /") before the title.
- [ ] Settings / Tracked list head (`QpXtY`): new `Move hint` (`KkzVQ`): keys ⌥↑ (`FqePR`) ⌥↓ (`fkgg1`) and "Move"
      (`Owtyz`), before "Track repositories A".
- [ ] Drop line (`gvZcM`): new component, a 2 px `$accent` line (`jlxsE`) with round caps (`eJjrT`, `Wyrfe`).
- [ ] G8 (`sUokO`): owner group headers `ZaIOI`, `l54WU`, `UTDPc` removed; 15 rows flat in the sidebar's order;
      caption (`bx80b`) rewritten.
- [ ] T17 (`vmn2a`): owner group headers `T9agL`, `SG3nx` removed; rows flat in the sidebar's order; caption (`UoNwD`)
      rewritten.
- [ ] New row `bVETM`: T26 (`ziv4q`, screen `V5BCt`) · Sidebar · Dragging a repository to a new place — the source row
      at 40 %, drop line `XHPCH` between fitloop/webapp and fitloop/api, grabbing cursor `OzIR1`.
- [ ] New row `bVETM`: T27 (`e3OAg`, screen `poJ0x`) · Settings · Repositories · Dragging a row — nuxt/nuxt dimmed,
      drop line `PpwSx` between mlaine/tasklet and mlaine/mdlint, cursor `cEgNw`.
- [ ] T18, T20, T22 and the docs figures DOC2, DOC4: still grouped by owner; the new owner prefix and the hint hidden
      on their instances (47 visibility overrides) so they look as before.
