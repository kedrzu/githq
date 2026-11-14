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
