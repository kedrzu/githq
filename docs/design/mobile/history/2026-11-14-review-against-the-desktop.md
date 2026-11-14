# Review of the phone screens against the desktop — 2026-11-14

The phone design landed in #214 (2026-11-09). Since then the desktop changed in ways the phone screens in `App · Mobile`
(`jy6bO`) do not show. Base of this review: `50220f18`; `bun nzyme pen diff 555fdd92` lists the desktop's changes. No
code exists for the phone layout yet, so nothing below is built.

## The desktop changed, the phone did not follow

- **The item thread** (`changelog/item-activity.md`, `conversation-cards.md`, `linked-comment.md`; F1–F23, I1–I4,
  `Components · Activity` `X7uA3I`). One thread on a rail: the description is the first comment card, events are one
  line with an icon on the rail, comments and reviews are cards with a head and a ⋯ menu, with sending, not sent and
  editing-in-place states; past 20 items the middle folds into "Show N earlier events" with its counts; "N new since you
  looked" marks where the new ones start; a comment linked from the address is outlined; the thread has loading, empty
  and failed states. Below 480 px of container the cards take a narrow layout (`wuC1d`): the gutter avatar moves into
  the head, which fits a phone. The phone still draws the old "Activity" list of plain lines with the description as
  plain text (MB60, MB61, MB91, MB92, MB95, MB97, MB126 and more), and none of the card states.
- **MB97's question is answered by it:** the desktop now has both the fold and "N new since you looked" (I2).
- **The composer** (I4, `Activity / Composer` states). Write / Preview, formatting tools that fold to ⋯ when narrow,
  @ and # menus, and beside Comment the item's close button: Close issue with its reason (completed / not planned),
  Reopen, Close pull request; closed, merged and read-only states. On the phone the box is a pill with a send button
  (MB70–MB73, MB91), with no preview, tools or closing: closing goes only through the chip's menu (MB109).
- **The summary** (F21, F22: one column below the split, the summary first). A pull request shows a standing card
  ("Can't merge yet": Checks, Reviews, Conflicts, the branch, size and files, then Merge…, Open on GitHub, Review
  files), Reviews as a list with Request, Checks as a list (failing first, Required, Log ↗, passed in one line), Closes
  as rows, then Assignees, Labels, Milestone as rows, and every project as a card with its fields. The phone (D25,
  MB125–MB128) has its own: a standing row, then Reviewers, Checks and Status as rows, the rest as chips that unfold,
  checks in a sheet (MB98), projects as headings.
- **Settings · Privacy** (T23, `usage-statistics.md`). The phone's sections list gained Privacy (`WNwK3`, through the
  shared component), but there is no phone screen for it.
- **Selection** (`list-row-selection.md`, `command-menu-selected-row.md`). A selected row is a rounded surface with an
  accent outline, and so is the command menu's highlighted result. The phone's selected rows (MB117–MB119) and its
  command menu still follow the old look.

No phone change needed: the item panel / full screen and the two columns (desktop D9 revised; the phone is always the
one column), the modal's removal, the stack bar's chevron (MB220 shows the rows already open), the toast tidy (the
phone
has one toast component), renewing the 8-hour token, opening on the last screen (#288, the phone does the same).

## Still open from the last review

- **D49:** where a changed project view is marked — variants MB222–MB225 are drawn and wait for the pick.
- **MB173:** the Empty groups switch is not on the desktop (`myWork/buildMyWork.ts` keeps empty groups; the list
  decides); under D46 it would not be in the first version.

## Missing before the phone can be built

- The thread's states on a phone: a comment's ⋯ menu as a menu at the bottom (D45), editing in place, sending, not
  sent, review cards, the linked comment, loading, empty, failed.
- Writing: preview, formatting, @ and # menus above the keyboard, closing with a comment.
- Settings · Privacy.
- The pull request's actions the phone does not have yet (Merge…, Review files, D4): what the standing card offers in
