Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/groovy-moth/githq.pen

- [x] List row (`TNgbS`, App · Components): taller rows and a rounded selection inside the row. The row is now the
  hit area, padding [7,16] → [2,8], and holds a new frame `Surface` (`XODhV`): padding 8 on every side, gap 10,
  corner radius 6, holding the type icon and the content. Rows grow 50 → 56 px (rows with a label chip 53 → 59);
  the text stays 16 px from the pane's edge. The whole row stays clickable, no gaps between rows. In code: the
  selection is a pseudo-element (or inner element) inset 2px 8px with radius 6.
- [x] Selected row: was the row's background `$sel` plus a 2 px `$accent` bar on the left, full bleed; now the
  `Surface` gets `$sel` and a 1 px outline `#7B87F74D` (accent at 30%), and the row itself has no fill or stroke.
  Applies to `List row / Issue · assignee, field, label` (`L0fP2E`), `List row / Issue · field, two labels`
  (`EOP25`) and every selected row on the screens. A selected row in red (`q352K`): outline `#F851494D`.
  _(Built: the accent outline. Not built: the red one — no list row is selected in red in the code yet.)_
- [x] Rows with their own padding keep their text where it was: `List row / PR · checks, in repo` (`fT1ix`)
  [7,16,7,42] → [2,8,2,34]; rows in a stack's rail [6,16,6,18] → [1,8,1,10].
  _(Built: the surface starts 8px before the text, 34px in, 58px one level deeper. The code's rows in a rail kept the
  full rows' 2px inset above and below, as they already had their padding, not the rail's.)_
- [ ] The same selection everywhere a row was selected edge to edge with an accent bar. Each row is now the hit area
  and holds a `Surface` frame (radius 6) that carries the selection: `$sel` plus a 1 px outline `#7B87F74D`
  (`#F851494D` for a row selected in red). Every row of the kind changed, not only the selected one:
  - Stack rows and stack headers in the list panes (`Stack row / collapsed` `noACw` and its variants, and the drawn
    `Stack …` / `Issue as stack header …` rows), drawn copies of list rows, `Phone / Row` (`pFppk`): row padding
    [7,16] → [2,8] (phone [11,16] → [3,8]), surface padding 8 on every side; the chevron moves down with the content.
  - One-line rows keep their padding inside the surface and grow 4 px (2 px inset above and below): `Workflow / Row`
    (`I98wYc`) 34 → 38, the runs under a workflow 30 → 34 (indent kept, surface padding [0,8,0,33]), the stack map
    rows 24 → 28.
  - `Commit row` (`EMjBX`): the graph stays outside the surface so its lanes run unbroken; the surface is 28 px high
    inside the 32 px row, from the graph to 8 px before the right edge. The faint stripe `#FFFFFF05` stays on the row.
  - Worktree menu: padding [6,0] → 4, items [6,12] → [6,8] with radius 5, like the other menus.
  _(Built: list rows, stack rows and headers, `Workflow / Row` 38, the runs 34, the stack map rows 28, `Commit row`.
  Not built, so left unticked: `Phone / Row` and the worktree menu — neither exists in the code yet.)_
  Already inset and rounded, so unchanged: menu items, command results, review file rows, ref list rows, settings and
  track rows, section items, job rows, board cards, phone places.
- [x] Stack rows: the expand chevron no longer sits absolutely in the row's left padding, where it ran into the
  selection's outline. It is now in the first line, right after the count of pull requests in the stack
  (`Migrate class calendar… 4 ›`), 11 px, `$fg-3`, gap 8; `chevron-down` when the stack is open. In an issue that
  heads a stack (`Issue as stack header …`, no count) it follows the title. Applies to `Stack row / collapsed`
  (`noACw`), its variants and every drawn stack row in the list panes (67 rows).
