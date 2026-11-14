# Nothing pinned to the right edge

A two-line list row keeps a spacer on line 1 and puts the avatars and the age at the far right, so on a wide window
the age sits far from the title it describes. The new rule in the `design` skill says every piece of information
follows its content; this feature applies it, starting with where a list row's age and people go. Base: `3eae49ab`.

## Round 1 · agent brief

Asked: two variants for the list row's avatars and age, each wide (1800 px pane) and narrow (440 px, beside an open
item), without changing any component. Changed: a new amber `Variants` frame in `App · My work` with four screens of
detached row copies.

- [ ] App · My work (`SUJHt`): new last child `Variants · Where a list row's age and people go` (`h8JtKd`), amber, two
  rows of slots, A above B so the wide screens line up.
- [ ] `D8 · Variant A · Age and people end the second line` (`w0Oui`): recommended. Line 1 is the title (and a
  stack's count and chevron); line 2 ends with the avatars, then the age, 10 px apart like the rest of the line. No
  spacer.
- [ ] `D9 · Variant A · … · beside an open item` (`ksxaq`): the same at 440 px; the status text truncates with an
  ellipsis, the avatars and the age stay whole at the end of line 2.
- [ ] `D10 · Variant B · Age and people follow the title` (`HGio3`): the avatars and the age right after the title,
  8 px apart; line 2 unchanged. No spacer.
- [ ] `D11 · Variant B · … · beside an open item` (`WQsDO`): the same at 440 px; the title truncates, the avatars and
  the age stay right after it; the status truncates as today.

The rows are detached copies of `List row / PR · review, assignee, size`, `List row / PR · checks, size`,
`List row / PR · checks, in repo`, `List row / Issue · assignee, field, label`, `List row / Issue · field, label`,
`List row / PR · approved, merge`, `List row / PR · your draft` (age "draft 2d") and `Stack row / collapsed, review`
(the stacked row with "4 ›" after its name; `List row / PR · stacked, size` has no count). They go when the owner
picks. The narrow screens hide the list header's quick filters and Group button so it fits; the header is not part
of the question. No component changed.

## Round 2 · owner's feedback

Asked: the owner picked Variant B and asked for two changes. A nested row's title looks like any other row's title,
and a pull request's number moves to line 1, right after its title. Then finish the variants. Changed: D10 and D11
show both changes and are now settled screens in a plain row; Variant A and the amber frame are gone. No component
changed.

- [ ] `D10` (`HGio3`), `D11` (`WQsDO`), every pull request row except the stack: new `Number` text on line 1 between
  the title and the avatars (`#482`, `#1203`, `#1202`, `#15`, `#477`, `#1205`), `$font` 13.5, regular, `$fg-2`, 8 px
  gap like the rest of line 1. The brief named `$fg-muted`; the file and `tokens.scss` have no such token, and
  `$fg-2` is Primer's fgColor-muted, so it is the one used.
- [ ] Same rows, line 2: `Ref` text renamed `Repository`, `fitloop/api#482` → `fitloop/api` (`$mono`, `$fg-3` as
  before). In the nested row `#1205` the `Ref` text was deleted, so line 2 starts with the status. Issue rows keep
  `fitloop/webapp#1187` and `mlaine/tasklet#12`. The stack row (`4 ›`) is unchanged.
- [ ] Nested row `#1205` title (`eByfn` in D10, `VjVsQ` in D11): `$fg-2`, 12.5, normal → `$fg`, 13.5, 500, the same as
  a top-level title. Its 34 px indent and 13 px icon stay.
- [ ] Row `#1203` title (`yHx9P` row in D10, `x3IC2` in D11): `Migrate class calendar to new date picker` → `Migrate
  class calendar to the new date picker and drop moment.js`, so D11 shows the title cut with an ellipsis before the
  number (`… new date pic…`). The old title fit at 440 px, so no PR title truncated.
- [ ] Deleted `Slot · D8 · Variant A · Age and people end the second line` (`F2WxBp`, screen `w0Oui`) and
  `Slot · D9 · Variant A · … · beside an open item` (`YxFpF`, screen `ksxaq`), with their row frame `owwWB`.
- [ ] App · My work (`SUJHt`): new `Row of screens · Nothing pinned to the right edge` (`Y6eGBA`, 80 px gap like
  the other rows, not amber) where the `Variants` frame was. It holds the D10 slot (`Mff7c`) and the D11 slot
  (`zE1Cs`), moved out of the `Iav6j` row.
- [ ] Deleted `Variants · Where a list row's age and people go` (`h8JtKd`) and its emptied row `Iav6j`.
- [ ] Renames, slot, screen and caption title: `D10 · Variant B · Age and people follow the title` →
  `D10 · Age and people follow the title`; `D11 · Variant B · Age and people follow the title · beside an open item`
  → `D11 · Age and people follow the title · beside an open item`.
- [ ] Captions (`WSdg2`, `JzIoG`) rewritten for the settled layout: title, a PR's number, avatars, age on line 1,
  nothing at the far right; line 2 starts with the repository; an issue keeps its reference; nested rows read like
  top-level ones; at 440 px the title gives way before the number, avatars and age.

Building it changes the list row components (`List row / …`, `Stack row / …`) and the code: the round left them
alone on purpose.
