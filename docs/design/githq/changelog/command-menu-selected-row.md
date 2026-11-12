# Command menu selected row

The highlighted result of the command menu (⌘K) was only a `$sel` fill, hard to see. It now looks like a selected
issue or pull request in a list: `$sel` plus a 1 px inside stroke `#7B87F74D` (accent at 30%), as on `List row` →
`Surface` (`list-row-selection.md`). The new issue's repository and template choosers share the list, so they follow.
Base: `c3dc7b27`.

## Round 1 · agent brief

Asked: the highlighted command result and the choosers' highlighted row outlined like a selected list row; popover
pickers (`$bg-3`) and menu items unchanged. Changed: every drawn highlighted result; `Command / Result` (`k3mGr`) has no
fill at rest, so it stays as it is and its highlighted instances carry the stroke.

Each entry: fill `$sel` unchanged, stroke none → `#7B87F74D` 1 px inside.

- [x] Command / Menu · search repositories (`r5WU3O`): `Result vitejs/vite` (`tbKqD`).
- [x] App · Command menu (`D27jC`): E1 `Result Set status…` (`ohKIj`), E2 `Result In review` (`h6KkJ`), E3
  `Result Platform onboarding` (`vghpm`), E4 `Result Set iteration → Sprint 15` (`PxKdt`), E5 `Result New issue`
  (`wHOOK`).
- [x] App · Settings (`i3VkT`): `Result Settings` (`LGEG0`).
- [x] App · Merging a pull request (`LLr2k`): PM39 `Result Merge…` (`kBS6Y`).
- [x] App · Workflows (`IEyTW`): W4k `Result Re-run failed jobs` (`ubN6i`).
- [x] App · Stacked pull requests (`LIEPU`): SP70 `Result Merge stack…` (`M0zlQ`), SP71 `Result Link into a stack…`
  (`YurPt`), SP79 `Result Link into a stack…` (`GkJeR`).
- [x] Desktop · Updates (`ohwJa`): U20 `Result Check for updates` (`FDwov`).
- [x] App · Creating an issue (`gvCqI`): H2 `Result fitloop/api` (`NjvQR`), H5 `Result fitloop/webapp` (`InI6i`), H7
  `Template Bug report` (`WyXID`).
- [x] Landing — githq.dev (`JJOFX`) and its mobile frame (`ucqck`): the ⌘K picture's `Result Platform onboarding`
  (`eDTHG`, `ITT64`), so the landing shows the app as it is. *(Nothing to build: the landing draws no command menu
  in code.)*

Built in code: `FilterList`'s highlighted row at the `md` and `lg` sizes (the command menu, the new issue's choosers)
takes `row-selected-surface` from `styles/tokens.scss`, the fill and outline `row-selected` gives a list row's surface.
