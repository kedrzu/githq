# Reading cursor on a pull request's thread

A pull request (or issue) opened full screen gets code review's cursor (D44) over its thread's stops: the description,
each comment, a review's own card and each comment of its code threads, a code thread posted alone, the viewer's draft
review, each commit of a push, each event line, a resolved thread's row, the fold. ↓ ↑ move it (accelerating while
held), PageDown PageUp a screen, the pointer moves it, `[` `]` jump from comment to comment, and every action (reply,
the card's ⋯ menu, quote reply, resolve, edit) acts on the stop it is on. Exactly one stop holds it, the innermost. The
owner wants a clear, calm mark of that stop and picks among competing ways of showing it. Base: `9a2de753`.

## Round 1 · agent brief

Asked (`.context/reading-cursor-brief.md`): in `App · Pull request`, a new row with an amber `Variants · How the reading
cursor shows`: A the current file's look (recommended), B a lit segment by the rail with a faint tint, C A plus a caret
for the cursor's place in a tall comment; each on the full-screen page with the cursor on a plain comment and a sheet
of every other kind of stop; the key help section for the thread (the action keys as a question) and the ⋯ menu with
its keys. Changed: two variables, one component restructured without a visible change, 23 new components, eight new
screens F24–F31, the frames below `App · Pull request` moved down.

- [x] Variables: new `current-edge` `#4F589D` and `current-header` `#1B2130`, the file's side of `tokens.scss`'s
  `$color-current-edge` / `$color-current-header` (they existed only in code).
- [ ] Review / Comment (`IHFo8`): the avatar (`J1oko`) wrapped in a new `Avatar column` (`kIiiC`, height
  fill_container), so a state can draw along the comment's height. Looks the same everywhere.
- [ ] 39 instances lost their avatar overrides (`…/J1oko` fill, `…/J1oko/zeZzP` initials) when the avatar moved; all
  78 restored to their values at the base revision (`uIXia`, `qrcqS`, `znW1W`, `GlhsY`, `YKqKB`, `DwBhj`, `PwdqU`,
  `jd4oq` and 31 screens' `WFYVj`). Check a few code review threads' avatars.
- [ ] App · Pull request (`XN8vf`): new last row `Row of screens · The reading cursor` (`TS9ng`); nothing above it
  moved.
- [x] Components · Reading cursor (`bkmox`), in that row (moves into Components · Activity once a variant is picked):
  - Rows, every variant: `Activity / Commit · current` (`xyiYO`, fill and a 6 px outer bleed `#7B87F71A`),
    `Activity / Event · current` (`uBr3s`, `#7B87F71A`, radius 6), `Activity / Fold · current` (`VRxDl`, band
    `$bg-2` + `#7B87F71A`), `Activity / Code comment · resolved, current` (`sx0mg`, the folded row `$bg` +
    `#7B87F71A`).
  - Cards, Variants A and C: `Review / Comment · current` (`fNNF4`: tint `#7B87F71A` bleeding to the thread card's
    edges by an outer stroke 5/12/5/12, a 2 px `$current-edge` mark on the card's left edge from the avatar column's
    stroke), `Activity / Comment · current` (`Dp20Y`: border `$current-edge`, head `$current-header`), `· linked,
    current` (`y3xMc`: head only, the `$accent` border kept), `· narrow, current` (`VlCXB`), `Activity / Review ·
    current` (`s5t76`), `Activity / Review · pending, current` (`f6qw8F`: head only, the amber border kept).
  - Cards, Variant B: `Review / Comment · current (B)` (`b05oDt`, tint only), `Activity / Comment · current (B)`
    (`Wv4fu`), `· linked, current (B)` (`SRvT4`), `· narrow, current (B)` (`X1IEKj`), `Activity / Review · current (B)`
    (`g0TRzR`), `Activity / Review · pending, current (B)` (`ImkNG`): head `$bg-2` + `#7B87F71A`, borders unchanged.
  - Variant C: `Activity / Reading caret` (`ZNAuv`, an 8 × 12 `$accent` triangle).
- [ ] Variants · How the reading cursor shows (`lTN61`, amber):
  - F24 · Variant A · The current comment, as the current file (slot `mzLjU`, screen `VN5jy`): F18's page, the thread
    scrolled to mlaine's comment, which is `Dp20Y`.
  - F25 · Variant B · The current comment, lit on the rail (slot `JdGyd`, screen `M7Qaar`): the comment is `Wv4fu`; a
    2 px `$accent` segment drawn in the feed at x 33 beside it, as the rail itself is drawn.
  - F26 · Variant C · A tall comment, the caret a third of the way down (slot `o2l5YY`, screen `jZYTH`): mlaine's
    comment made four paragraphs long, `Dp20Y`, the caret in the gutter a third down.
  - F27 (slot `gkuKb`, sheet `T2Mnvm`), F28 (slot `wjEgA`, sheet `S1KXk`), F29 (slot `H3fLcv`, sheet `r8nSx`): Variant
    A, B, C on a comment in a review's code thread, a commit, an event line, a resolved thread's row, the fold, a
    linked comment, the draft review and the narrow one-column card.
- [x] F30 · Question · Keys for the thread's cursor and its actions (amber slot `sH3i5`, screen `E2nZW`): the key help
  (?) as a `Keyboard shortcuts` dialog over F24 with a `The thread` section: `[` `]`, ↓ ↑, PgDn PgUp, R, and the
  proposed `.` the comment's menu, `Q` Quote reply, `H` Resolve or unresolve, `W` Edit. The caption lists the keys
  checked free on the item and every screen sharing its keys: B G H Q W Y Z . ; (F is the workflows', V the review's).
- [x] F31 · The comment's menu, opened by its key (slot `Htj0R`, screen `PjVCn`): `nS2AY` open under mlaine's current
  comment, `W` on Edit and `Q` on Quote reply; Copy link and Delete without a key.
- [ ] Layout: `XN8vf` grew 4186 px (20476 → 24662) and 100 px wider; the 29 top-level frames that started at y 26240
  or below (`CEDLB`'s row and every row under it) moved down 4186 px as whole rows, keeping their gaps.

Not drawn: an issue's thread (the same stops without reviews and commits) and the cursor arriving on the description;
both follow the comment's look.

## Round 2 · owner's pick

Asked (`.context/reading-cursor-brief-2.md`, the owner on 2026-11-18): Variant A, with no left-edge mark anywhere: a
comment inside a code thread, when current, gets only the tint on its part of the thread card. The cursor stays
invisible (no caret). The keys `.` menu, `Q` quote reply, `H` resolve / unresolve, `W` edit are settled; `E` stays code
review's (an item can be open over a review). Changed: Variants B and C deleted, A's screens moved out and renamed, F30
settled, the remaining components moved next to their bases, the frames below `App · Pull request` moved back up.

- [x] Review / Comment · current (`fNNF4`): the 2 px `$current-edge` mark on the card's left edge removed (the
  `kIiiC` stroke override); only the tint `#7B87F71A` stays, bleeding to the thread card's edges.
- [ ] Review / Comment (`IHFo8`): the `Avatar column` wrapper (`kIiiC`) removed, the avatar (`J1oko`) back as the
  first child, as at the base revision. Looks the same.
- [ ] The 78 avatar overrides (`…/J1oko` fill, `…/J1oko/zeZzP` initials) were lost by that move and restored to their
  values before it, compared key by key (`uIXia`, `qrcqS`, `znW1W`, `GlhsY`, `YKqKB`, `DwBhj`, `PwdqU`, `jd4oq` and 31
  screens' `WFYVj`); code review threads `UileD` and `jd4oq` render as before.
- [ ] Deleted Variant B and C screens: F25 (slot `JdGyd`), F26 (`o2l5YY`), F28 (`wjEgA`), F29 (`H3fLcv`), with their
  rows `eqlQW`, `B90kX`.
- [ ] Deleted B/C-only components: `Review / Comment · current (B)` (`b05oDt`), `Activity / Comment · current (B)`
  (`Wv4fu`), `· linked, current (B)` (`SRvT4`), `· narrow, current (B)` (`X1IEKj`), `Activity / Review · current (B)`
  (`g0TRzR`), `Activity / Review · pending, current (B)` (`ImkNG`), `Activity / Reading caret` (`ZNAuv`), with their
  columns `i6q6F`, `k7YE9H`.
- [x] F24 (slot `mzLjU`, screen `VN5jy`): moved into the row `TS9ng`; `F24 · Variant A · The current comment, as the
  current file` → `F24 · The current comment, as the current file`; caption: picked by the owner, no mark on any edge
  and no caret, "see F25" → "see F27".
- [x] F27 (slot `gkuKb`, screen `T2Mnvm`): moved into `TS9ng`; `F27 · Variant A · The cursor on every other kind of
  stop` → `F27 · The cursor on every other kind of stop`; caption: a comment in a code thread gets only the tint, no
  mark.
- [ ] Variants · How the reading cursor shows (`lTN61`, amber): deleted, with its head and the `Variant A` row
  (`O0Ijm`).
- [x] F30 (slot `sH3i5`, screen `E2nZW`): `F30 · Question · Keys for the thread's cursor and its actions` → `F30 · Keys
  for the thread's cursor and its actions`; amber fill, stroke, padding and radius removed from the slot; caption: the
  keys are settled, E isn't used because it is code review's (expand hidden lines) and an item can be open over a
  review.
- [x] F31 (caption `m67Kfj`): "both proposed in F30" → "F30"; "drawn in Variant A's look" → "the comment under the
  cursor has F24's look".
- [ ] Components · Activity (`X7uA3I`), each next to its base, its height unchanged (no screen moved), 1440 px wider:
  `Activity / Commit · current` (`xyiYO`) after `pbG2Y` and `Activity / Fold · current` (`VRxDl`) after `lshuQ` in
  Shared; `Activity / Event · current` (`uBr3s`), `Activity / Comment · current` (`Dp20Y`) and `Activity / Review ·
  current` (`s5t76`) after their bases in Item thread; `Activity / Code comment · resolved, current` (`sx0mg`) after
  `NXXMN` in Writing; `Activity / Review · pending, current` (`f6qw8F`) after `PwdqU` and `Activity / Comment · linked,
  current` (`y3xMc`) after `iMK9U` in Comments and reviews; `Activity / Comment · narrow, current` (`VlCXB`) after
  `k6csA` in Narrow cards.
- [ ] Components · Code review (`crvke`): `Review / Comment · current` (`fNNF4`) moved under its base `IHFo8` in
  Thread parts › Comments (`QzHN5`), not into Components · Activity, since its base lives there.
- [ ] Components · Reading cursor (`bkmox`): deleted, empty.
- [ ] Layout: the row `TS9ng` shrank to F24, F27, F30, F31 (4158 → 1270 high); `XN8vf` 2888 px shorter (24662 →
  21774) and 1340 px wider (9730 → 11070, from Components · Activity); the 29 top-level frames that started at y 30426
  or below moved up 2888 px as whole rows (the code review row now at 27538). The stray root text `BnN7r` was not moved,
  as in round 1.

## Round 3 · owner's feedback

Asked (`.context/reading-cursor-brief-3.md`, the owner on 2026-11-18): fix the clipped layouts (F27's draft review
toolbar ran past its card, Submit cut by the amber border) by layout, not by widening screens; drop the trailing "…"
from every button, menu item and command label in the file, `Merge…` becoming `Merge pull request`; keep it on
placeholders, progress texts and layout truncation. Changed: one component's layout, one shared header's spacer, two
components moved to a wider column, 63 labels, 22 captions and 27 layer names. No node copied, no instance re-created:
every label is a content change on its node or an override on its instance (ids checked unique and every ref resolving
to a reusable node through the MCP before saving).

### Clipped layouts

- [x] Review / Pending toolbar (`OCfqo`): the note (`w6fa5w`) wraps (`fixed-width`, `fill_container`) and the spacer
  (`T3XYh`) is hidden, so the note takes the room left and the buttons never move past the edge; height 44 →
  `fit_content(44)`, padding `[0,8,0,14]` → `[10,8,10,14]`, layout made explicit (horizontal); the Title row (`fA0IB`)
  24 px high so a one-line toolbar stays 44 px in every state. F27's draft review (`B0CQM1`, 640 px): one row, the note
  on two lines, 54 px high; F14 (`z2SZAj`) and the code review's diff column stay one line at 44 px.
- [ ] Review / Pending toolbar (`OCfqo`) and `· failed` (`zWVql`): moved from `Left column parts` (`c9jmMT`, 300 px,
  too narrow for them) to the head of `Writing` (`hCsvh`) next to their other states; `Writing` 560 → 900 px (its
  states were 900 px wide already), `Thread parts` (`SSotp`) 4110 → 4450 px, inside `Components · Code review`'s width.
- [ ] Item / Checks header (`UYFLP` in `JKPLA`): the spacer (`jOqHL`) hidden; the commit text ran 1 px past the 376 px
  summary in F24 and F30 (`Ey47x`); it now follows the summary of checks.
- [ ] Item / PR merge (`BioKQ`): layout untouched. `Merge pull request` fits the panel (512 px) and the merging
  screens (580 px), but not the 376 px summary card (`XPhTt` in `Item / Summary · pull request`, F18, F24, F30) nor
  the phone variant (`T6Pdf7`, 358 px): the three buttons need ~430 / ~410 px and a Pen row cannot wrap. Those two say
  `Merge` (an override on `lsKaS`) until the owner decides how the row breaks there. Same on SP5's hand-drawn panel copy
  (`zAmge`, 11 px short).
- Checked, left as they are: code lines cut by a narrow code excerpt (`Components · Activity`'s narrow review cards),
  threads and summaries cut at a screen's foot (F24, F30), the rail's badge overhang. Not in this round's scope and
  unchanged: L2's `Re-request` (`h0qFyP`) runs 4 px past the Request review submenu; M2/L2's merge item shows a
  `git-merge` icon where a chevron was (`s1j0T`).

### Labels, before → after

- [ ] Components:
  - Item / PR merge (`BioKQ`): `Merge…` → `Merge pull request` (`lsKaS`).
  - Review / Pending toolbar (`OCfqo`): `Discard review…` → `Discard review` (`wqUGr`), `Submit review…` → `Submit
    review` (`RMOTL`); `· failed` (`zWVql`): `Edit review…` → `Edit review`.
  - Activity / Comment menu (`nS2AY`): `Delete…` → `Delete` (`UUyle`).
  - Item / Summary · pull request (`NjMaL`, `XPhTt`) and Item / PR merge · phone (`T6Pdf7`): `Merge…` → `Merge` (see
    above).
- [ ] App · Pull request (`XN8vf`): key help `Submit your review…` → `Submit your review` (`MvVAW`, row `kLH8s`).
- [ ] App · Code review (`CEDLB`): key help `Submit review…` → `Submit review` (`hxXEH`, row `ATb60`); the submit dialog
  buttons `Submit review…` → `Submit review` (`Lrzcr`, `AWNGP`); the hint `Submit…` → `Submit` (`fn4wZ`).
- [ ] App · Command menu (`D27jC`): `Set status…` ×2 → `Set status`, `Set priority…` → `Set priority`, `Set
  iteration…` → `Set iteration`, `Assign to…` ×2 → `Assign`, `Add or remove labels…` → `Add or remove labels`, `Close
  issue…` → `Close issue`, `Group by…` ×2 → `Group by`, `Add to another project…` → `Add to another project`, `Add
  labels…` → `Add labels`, `Close 3 issues…` → `Close 3 issues`, `Order by…` → `Order by`, `Search repositories…` →
  `Search repositories` (E6, `F1thkx`).
- [ ] App · Context menu (`uWch5`): `Merge…` → `Merge pull request` (`YnKgl`), `Close as duplicate of…` → `Close as
  duplicate` (`B4Dq4K`).
- [ ] App · Item menu (`xgYRz`): `Merge…` → `Merge pull request` (`aZPvu`).
- [ ] App · Merging a pull request (`LLr2k`): `Revert…` → `Revert` (`D22dpX`), `Queue…` → `Queue` (`q9eCkj`),
  `Auto-merge…` → `Auto-merge` (`DEdfl`), `Mark ready…` → `Mark ready` (`kUaDx`).
- [ ] App · Stacked pull requests (`LIEPU`): `Merge…` → `Merge` (`zAmge`, SP5), `Link as a stack…` → `Link as a stack`
  (`Ce6Ns`), `Merge stack…` → `Merge stack`, `Add a pull request on top…` → `Add a pull request on top`, `Add on top…`
  → `Add on top`, `Dissolve stack…` ×2 → `Dissolve stack`, `Link into a stack…` ×2 → `Link into a stack`, `Assign…` ×3
  → `Assign`, `Label…` ×3 → `Label`.
- [ ] App · Workflows (`IEyTW`): `Run workflow…` → `Run workflow` (the item head's button `Z77eN`, command results
  `XDjCY`, `V07KCN`).
- [ ] App · Settings (`i3VkT`): `Stop tracking…` → `Stop tracking` (×6: `OMjCC/B51Lj`, `cnrP3/H9AJ5k`, `bgmkW/Ovylc`,
  `sc1pF/bMrIM`, `ocatW/T6nssq`, `cWv8Z/sEmMI`).
- [ ] App · Mobile (`jy6bO`): `Filter…` → `Filter` and `Sort and group…` → `Sort and group` (command results `y5AfkM`,
  `mZrl9`), `Delete…` → `Delete` (`Hvbw2`), `Resolve…` → `Resolve` (`q5Pag`), `Mark ready…` → `Mark ready` (`OA04b`).
- [ ] Captions quoting those labels, same before → after (`Merge…` → `Merge pull request` on the desktop, `Merge` on
  the phone): `i9uua`, `o5NKSb`, `klRij`, `o9BXr` (XN8vf); `JpbpK`, `aCSQ2`, `K7Vxiw`, `nMKsz`, `wbf2k`, `tvSZQ`,
  `PYIvB` (CEDLB); `IS15j`, `gFIsY`, `j8W8yw` (LLr2k); `Anrxt`, `LZy1y` (D27jC); `hFwIS` (Zk4sa); `kA1Ux`, `JsH6J`,
  `Rj3dd`, `aIIvY`, `PqUdr` (jy6bO).
- [ ] Layer names that carried the old label lost the "…" (27, e.g. `Result Set status…` → `Result Set status`).
- Kept: placeholders (`Reply…`, `Search or jump to…`, `Filter…`, `Assign to…` in the phone's assignee picker, `Branch
  or tag…`, `Add to your draft…`), progress texts (`Sending…`, `Checking…`, `Reading…`) and truncated text.

## Merge · main (#350) into this branch

Conflict: both sides moved the same top-level frames down. This branch grew `App · Pull request` (`XN8vf`) and moved
every frame from y 26240 by 1298 px; main grew `App · Command menu` (`D27jC`) and moved the rows below it by 1292 px.
Both hold, so each conflicting frame moved by both (kept value + 1292). Checked: no top-level frames overlap,
`App · Command menu` ends at 73805 above the next row at 75005, `App · Pull request` ends at 26435 above 27538.

- [ ] Flows and states row (`Zk4sa`, `gvCqI`, `i3VkT`, `epLfx`, `iZkBN`, `O6Vuj8`, `Sz7Bf`): y 73713 → 75005.
- [ ] Platforms row (`rV6qN`, `ohwJa`, `Ri8IR`, `jy6bO`): y 86470 → 87762.
- [ ] Web and brand row (`JJOFX`, `ucqck`, `XCfAD`, `jv9Tp`, `ykYxo`, `I5wWZ`, `S5J7kt`, `nCTdq`, `PiKGF`): y 128765 →
  130057.

## Owner's decision on the merge button's label (2026-11-18)

Where "Merge pull request" does not fit — the summary card in two columns (376 px) and on a phone (358 px) — the button
says "Merge", without "…"; everywhere it fits (the panel, the merging screens, the menus) it says "Merge pull request".
The file already draws it so after round 3; nothing to change.

## Round 4 · implementation

Built on this branch: F24 and F27 (the stops' marking, Variant A without an edge mark), F30 (the key help's "The
thread"), F31 (`W` and `Q` in the comment's menu); the variables were already `tokens.scss`'s
`$color-current-edge` and `$color-current-header`. The code's pending toolbar already kept its buttons whole: its note
is cut short on one line rather than wrapped, which the drawing's wrap stands for. The labels of round 3 and the merge
button's are built in #354, their own pull request; the other unticked entries are the file's own layout and need no
code.
