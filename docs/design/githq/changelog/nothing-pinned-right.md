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

- [x] `D10` (`HGio3`), `D11` (`WQsDO`), every pull request row except the stack: new `Number` text on line 1 between
  the title and the avatars (`#482`, `#1203`, `#1202`, `#15`, `#477`, `#1205`), `$font` 13.5, regular, `$fg-2`, 8 px
  gap like the rest of line 1. The brief named `$fg-muted`; the file and `tokens.scss` have no such token, and
  `$fg-2` is Primer's fgColor-muted, so it is the one used.
- [x] Same rows, line 2: `Ref` text renamed `Repository`, `fitloop/api#482` → `fitloop/api` (`$mono`, `$fg-3` as
  before). In the nested row `#1205` the `Ref` text was deleted, so line 2 starts with the status. Issue rows keep
  `fitloop/webapp#1187` and `mlaine/tasklet#12`. The stack row (`4 ›`) is unchanged.
- [x] Nested row `#1205` title (`eByfn` in D10, `VjVsQ` in D11): `$fg-2`, 12.5, normal → `$fg`, 13.5, 500, the same as
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

## Round 3 · agent brief

Asked: apply the rule to the reusable components, so every screen built from them follows it: the list row to the
`D10` layout, and in every other named component the information right after its content, with only edge controls
(⋯, Viewed, Untrack, a chevron, Request, key hints, the list's view controls) left at the edge. Changed: the
components below; screens follow through their instances. Screens are not edited by hand.

- [x] `List row` (`TNgbS`): spacer `XFLYs` deleted; new `Number` text (`w2vdFA`) on line 1 between the title and the
  avatar (`$font` 13.5, regular, `$fg-2`), hidden in the base (an issue). Line 1 reads title, number, avatars, age,
  8 px apart.
- [x] `List row / PR · …` variants (`Oo1Zf`, `O23QmN`, `jzfoH`, `fT1ix`, `g500aY`, `PDcPO`, `G4z7b`, `ERjCm`,
  `oGnve`, `a9pnc`, `NL2wd`, `x0yPk`, `S9Cxc`, `J8qcb`, `ZTzH7`; `pSXO7` and `p5nAi` inherit): `Number` shown with the
  variant's number (`#482`, `#15`, …); line 2's `Ref` text `owner/name#N` → `owner/name`, renamed `Repository`. In
  `List row / PR · stacked` (`oGnve`, `#1206`) line 2's `#1206` was deleted, so it starts with the stack marker.
- [x] `List row / PR · checks, in repo` (`fT1ix`, the row nested under an issue): title `$fg-2`, 12.5, normal →
  `$fg`, 13.5, 500 like a top-level title (an override with the base's values: Pen can't remove an override's
  property); line 2's `#1205` hidden, so line 2 starts with the status; `#1205` is the `Number` on line 1. The 13 px
  icon and the panes' indent stay. Its `Ref` text is now `kqSSS` (the old `tfyMQ` was replaced); instances that
  used the variant as a top-level row (`hiiGM`, `dyADF`, `k2FwBb`, `prdrK`, `HxNB0`, `VHWvO`) show it with their
  repository, `qFNFt` (an issue) shows its full reference and no number.
- [x] Every instance of a list row, in components and screens (about 300 overrides): a pull request's reference
  override `owner/name#N` (or `name#N` in the project panes) became `owner/name` plus the `Number` override `#N`;
  `#N` alone hides the line 2 text. Issue rows keep their references; issue rows built on a pull request variant
  (`Row fitloop/api#463`, `Row tanstack/query#8120`, …) hide the `Number`. Rows nested under an issue that overrode
  the smaller title (15 instances) get the top-level title.
- [x] `List row / PR · selectable` (`HfPmV`): spacer deleted; new `Number` (`PZUyB`) `#477` after the title; line 2
  `fitloop/api#477` → `fitloop/api` (`Repository`). Its instances (`PisMf`, `D8qj1`, `m4vzF`) show `#70`, `#71`, `#74`.
- [x] `List row / PR · selectable, plain` (`ZYL9A`, a nested row): spacer deleted; title `$fg-2` 12.5 normal → `$fg`
  13.5 500; new `Number` (`kHDcP`) `#94` after the title; line 2's `#94` deleted, so it starts with the size.
  Instances `L8PNJ`, `u7sBA` show `#95`, `#97`.
- [x] `Stack row / collapsed` (`noACw`, `b9IXF` inherits), `Stack row / collapsed, review` (`khfI5`): line 1 spacer
  deleted; avatars and age follow the count and chevron. `Stack row / Follow-up` (`nCmcE`) had no spacer: unchanged.
- [x] Detached stack rows inside `List pane / Stacks · first not approved` (`CZ9OM`), `· in a panel, stack of ten`
  (`v7Aw0N`), `· all collapsed` (`bPRlT`), `· next stack` (`p1yIM`), `· stack of two` (`y6kb9`) and
  `Stack / State group · held` (`s7T5wS`): the line 1 spacer deleted in each of the 26 (they are copies of
  `Stack row / collapsed` inside components, so the panes follow the rule too).
- [ ] `Compact row / Issue` (`xdWj1`): spacer deleted; `High · Todo` follows the title.
- [x] `Empty / Ghost row` (`zB3nE`): spacer deleted; the age bar follows the title bars. `Empty / Ghost commit row`
  (`J0Vrj`): spacer deleted; author and date bars follow the headline bar.
- [x] `Commit row` (`EMjBX`): spacer deleted; avatar, name and date follow the PR link and CI mark. `Date cell`
  (`R67Crc`) 30 px, right-aligned → fit to content, left. The author name keeps its 110 px box (it truncates there).
- [x] `Track / Repository row · ticked` (`EzonN`), `· unticked` (`PInZ1`), `Track / Project row · ticked` (`Vy3ob`;
  `FynUy`, `z2Nei`, `aThGZ` inherit): spacer deleted; `Activity` (110/120 px, right-aligned) and `Items cell`
  (80 px, right-aligned) → fit to content, left, so the count and the activity follow the name and the pill at the
  row's gap. A column no longer lines up once it follows a name of any length.
- [x] `Settings / Tracked repository row` (`CqvD4`, `Dht0d` inherits), `Settings / Tracked project row` (`L5sxR`,
  `jbKD6` inherits): the spacer moved from after the pill to just before `Actions` (Untrack and the chevron);
  `Items cell` (80 px) and `Sync cell` (120 px), right-aligned → fit to content, left.
- [ ] `Repository / Header · not tracked` (`tb2FD`): the spacer moved from before `120 of 3412` to before the Filter
  tool, so the count follows the section tabs and Filter, Open, Group, the layout switch, Display and GitHub stay at
  the edge.
- [x] `Project / Filter bar` (`LHimd`): spacer deleted; `Group Status · Sort Priority` follows `+ Filter F`.
- [x] `Diff / File header` (`pAbDY`; `CcHDa`, `cfQJk`, `GwweZ`, `zUTmp`, `ruHZc`, `iKVFx` inherit): the spacer moved
  from after the path and tags to just before `Viewed V`; the thread count and `+62 −18` follow the path.
- [x] `Item / Reviews` (`JqSRM`): the spacer in each reviewer row deleted; avatar, name, state, age left to right.
  The heading's spacer before `Request ⇧R` stays.
- [x] `Item / PR merge` (`BioKQ`): the spacers in the three condition rows, the branch line and the action row
  deleted; `+486 −12 9 files` follows `mlaine:idb-store → main`, a condition's aside follows its text, the note
  follows the buttons.
- [x] `Item / Linked` (`MGnYu`): spacer deleted; the status follows the title and number.
- [x] `Stack bar` (`cVyyK`): spacer deleted; the places follow the name and chevron.
- [x] `Status bar / segment` (`xhZTU`): the hidden spacer `msxAB` deleted; the detail text follows the main text in
  the 21 instances that show one.
- [x] `Activity / Event` (`umLcQ`; `W3NY8` inherits): `More` text fixed-width, fill → hugs its text, so the time
  follows who and what.
- [x] `Activity / Push` (`lkjfC`; `dsBwi` inherits): line spacer deleted; the time follows `pushed 3 commits`.
  `Activity / Commit` (`pbG2Y`): `Message` fixed-width, fill → hugs its text; CI mark and hash follow it.
- [x] `Activity / Code excerpt` (`VAMmB`): spacer deleted; `Outdated` follows the path and lines.
- [x] `Activity / Resolved threads` (`mrRDc`): the spacer moved to just before `Show`; avatars and `2 comments`
  follow the path.
- [x] `Activity / Review` (`b1us0` and its variants): the head's spacer moved from after the time to just before
  `⋯`, so `2 threads · 1 resolved` follows the time. `Activity / Comment` (`WHy4W`) already had only `⋯` after its
  spacer: unchanged.
- [x] `Submodule / Commit row` (`ad2zp`): `Subject` fixed-width-height, fill → hugs its text; the author follows it.
  `Submodule / File row` (`lDSIq`): `Path` likewise; the size follows it.

Follow the desktop through inheritance, though the brief left phone components alone: `Item / PR merge · phone`
(`T6Pdf7`) and `Item / Reviews · phone` (`egNv9`) are instances of `BioKQ` and `JqSRM`, so their rows lost the same
spacers.

Detached copies left as they are, not following the rule (copies of list rows, stack rows, repository headers and
filter bars drawn into screens):

- App · Stacked pull requests: list rows in `SP2`–`SP8`, `SP20`–`SP25`, `SP38`, `SP80`, `SP82`, `SP84` and the
  screens in its unnamed rows.
- App · States: rows in `K1`, `K7`; filter bars in `K6`, `K7`.
- App · Toasts: the row behind the toasts in `N2`–`N5`.
- Repository headers drawn by hand: App · Repository `J1`–`J3`, `CH1`, `CH2`, `CH4`, `CH5`; App · Commits `CH3`,
  `CH6`, `CH10`–`CH48`; Desktop · Commits `CD2`–`CD7`; App · Loading and empty states `ES9`–`ES29`; App · Repository
  and project menu `R1`, `R3`; App · Project `J3`.
- `D10` and `D11` are detached drawings of the settled row; they already follow it.

App · Workflows was not touched.

## Round 4 · repair, then implementation

Round 3 left 60 empty overrides on screen instances of the list panes (`IGHgn/XODhV` and `V1xcp/XODhV`, the
`Surface` of the row `fitloop/api#463`): a replacement by a ref to the same path, with no property, which
`bun nzyme pen check` rejects. Pen's editing API cannot delete an override entry, so a repair round changed nothing,
but saving the file turned each of them into a full replacement of that row's `Surface`, drawn in the new layout. The
check passes and the screens look right, but in those 60 instances the row no longer follows `List row`.

- [ ] 60 list pane instances (`PVeod`, `DviMk`, `RgGsc` and 57 more, across My work, Repository, Pull request, the
  menus, Creating an issue, States, Freshness, Desktop · Updates, Settings, Stacked pull requests, Merging, Code
  review, Issue and the landing's hero picture): the row `#463`'s `Surface` is a detached copy. Left for a later
  clean-up: remove these overrides so the row follows its component again.

Implementation: the app builds the round 2 and 3 entries ticked above. Not built because the app has no counterpart:
`Compact row / Issue` and the repository header's `120 of 3412` count. Where the code differs in detail: a tracked
row's count and sync note drop their fixed column widths so they follow the name, and a stack bar's end still toggles
the rows on click, as the spacer did.
