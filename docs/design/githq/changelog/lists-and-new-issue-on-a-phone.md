Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/groovy-moth/githq.pen

Brief: `docs/design/mobile/ui/lists-and-new-issue-on-a-phone.md`. Everything is inside `App · Mobile` (`jy6bO`), in the new
section `Lists and new issue on a phone` (`JKdmE`), codes MB173–MB217, all picked by the owner (mobile D36–D42); every
screen is in Screens (`u9CeG0`). Codes MB177–MB192, MB197–MB199, MB201–MB203 and MB212 belonged to rejected variants or
dropped questions and are gone.

## Changed components and settled screens

- [ ] `Phone / Group header` (`uIaHH`): new `spacer` (`Vcaek`) and `Add` (`Dm2mc`, plus, 16 px, `$fg-3`) after the count,
  off by default. On in `Phone / List / Project · Current sprint` (`x5FXSy`) on its three group headers, so every
  project screen built on it (MB63, MB81 and the others) shows + at the right of each group: it starts a new issue in
  that group (MB210). Repositories and My work don't get it.
- [ ] `Phone / New issue` (`K48kY`) deleted: the icons above the keyboard were rejected (D42). MB67 (`AssZ6`) and MB68
  (`c3sF8`) now show `Phone / New issue / Form` (`HpEKu`) with the keyboard, and their captions say the repository step
  comes first (D38).

## New components (Components · Mobile → `Lists and new issue`, `Kg17q`)

- [ ] Atoms (`sPPpb`): `Phone / Option chip` (`twgat`: 34 px pill, `$border-2` stroke, `Lead` icon off, `Label` 14 px
  `$fg-2`, `Trail` icon off); `· selected` (`r1ieBS`: `$sel` fill, `$accent` stroke, label `$fg`; with `Trail` on it is
  the sort direction); `· filter` (`NRdDB`: `$bg-3`, label `$fg`, × trail); `· add` (`W7cWdw`: + lead, "Filter").
- [ ] Atoms: `Phone / Toast button` (`gYX8L`: 36 px, `$bg-3`, `$border-2` stroke, 8 radius, label 14 px 600, optional
  icon) and `· primary` (`l07D9`: `$accent` fill, dark label, + icon, "Create another").
- [ ] Rows (`upuLA`): `Phone / Toast · with actions` (`ajtfg`, D40): the desktop `Toast` (`E6hAh`) on a phone, 366 px,
  `$bg-2`, 12 radius, shadow; head with a green check, `Title` (`i7CoM`, 14 px 600), `Detail` (`P9cMl0`, 13 px `$fg-2`) and
  the countdown close; `Actions` with `Create another` (primary) and `Open`.
- [ ] Rows: `Phone / Banner · answered by GitHub` (`QBCz2`, purple tint, cloud icon, Why); `Phone / Banner · no new issues
  here` (`VohF9`, amber, circle-slash, Change; part of the form, off, for a repository whose issues are off reached
  without the repository step, e.g. from a link); `Phone / Property · assignees, assign to me` (`W7sKw0`: "Nobody" and an
  `Assign to me` add chip at its end).
- [ ] Sheets (`WXpfb`): `Phone / Sheet / View options` (`BcxyQ`, D36): head with the list's name, the place under it and
  Done; Filter (filter chips + Filter), Group by (chips scrolling sideways), `Empty groups` switch row (`KwOQp`, "groups
  with nothing in them"), Sort by (chips, the chosen one with its direction), Select items (D28), "This view on GitHub ↗".
- [ ] Sheets, command-menu steps from `Phone / Command result` and `Phone / Command section`: `… / Filter · fields`
  (`DMySX`), `… / Repository · picking` (`aCoEC`, D38: Draft issue first in a project, tracked repositories, one whose
  issues are off dimmed with the reason, then "On GitHub"; picker input and keyboard), `… / Template · picking` (`F85iW`,
  D39: forms "on GitHub ↗" where you can't push, markdown, blank issue turned off dimmed).
- [ ] Panes (`fG7Dr`): `Phone / New issue / Form` (`HpEKu`, D42). Top to bottom: head (×, New issue, Create), `Can't create
  here` banner (off), `Rejected` block (`DXo0N`, off: reason in GitHub's terms, Try again · Another repository · Copy as
  Markdown), Repository row, `Template` row (off), title, `Assignees` (the assign-to-me row), `Project field` (off),
  `Parent` (off), `Chips` (Label, Milestone, Type, Project; a second line off), body. When the project row is on, the
  Project chip is hidden.
- [ ] Data used by the drawings: Current sprint's filter on GitHub is `iteration: @current` (34 items).

## Screens (`u9CeG0`)

- [ ] `Row · A list's options` (`aP3px`, D36): MB173 a project view (`s3IZJ`), MB174 a repository's issues (`RbdUX`,
  milestone first, then assignee, author, status, label, issue type), MB175 My work (`S4Sy0C`, reason, repository,
  status, author; no GitHub row), MB176 adding a filter (`Yts1P`, + Filter opens the command menu's Filter step).
- [ ] `Row · Shaping a list`: MB205 a project with no single-choice field (`wKYlM`); MB206 its options (`mNtLe`, Group by
  starts at No grouping, then Due, Owner, Pages; Empty groups hidden); MB207 a view whose filter GitHub answers (`L1eLN`,
  purple strip under the top bar); MB208 an empty project (`Oomfc`); MB209 an empty saved view (`HhXqa`).
- [ ] `Row · Starting a new issue`: MB193 the repository is chosen first (`bp6Nd`, D38); MB200 the templates rise once the
  repository is chosen (`j5s86`, D39); MB194 writing the title (`H1y1T`, D42); MB195 details set (`kaOWp`); MB196 a chip
  opens its step (`hqCS9`); MB210 from a project's group (`Hilde`, Status Todo · Platform Q4 as the project row); MB211
  from an open issue (`svX2C`, ⌘ → New sub-issue: Parent row, the parent's project offered as a chip); MB213 an issue
  form as a pre-filled body (`wJlZS`); MB214 creation rejected by GitHub (`wAEwR`, text kept).
- [ ] `Row · Created, and drafts`: MB215 created, back on the list (`ELJjE`, new row lit at the top with "number on its
  way", count 142 → 143); MB204 Create another, from the toast (`S98CNQ`, D40, the number arrived); MB216 a draft issue in
  a project (`b3i6L`, Repository row "Draft in Platform Q4", no chips); MB217 the draft in the project (`lCoHJ`, "Draft"
  where the reference is, type icon `file-pen-line`). All three toasts are `Phone / Toast · with actions`.
