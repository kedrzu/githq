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

- [ ] Variables: new `current-edge` `#4F589D` and `current-header` `#1B2130`, the file's side of `tokens.scss`'s
  `$color-current-edge` / `$color-current-header` (they existed only in code).
- [ ] Review / Comment (`IHFo8`): the avatar (`J1oko`) wrapped in a new `Avatar column` (`kIiiC`, height
  fill_container), so a state can draw along the comment's height. Looks the same everywhere.
- [ ] 39 instances lost their avatar overrides (`…/J1oko` fill, `…/J1oko/zeZzP` initials) when the avatar moved; all
  78 restored to their values at the base revision (`uIXia`, `qrcqS`, `znW1W`, `GlhsY`, `YKqKB`, `DwBhj`, `PwdqU`,
  `jd4oq` and 31 screens' `WFYVj`). Check a few code review threads' avatars.
- [ ] App · Pull request (`XN8vf`): new last row `Row of screens · The reading cursor` (`TS9ng`); nothing above it
  moved.
- [ ] Components · Reading cursor (`bkmox`), in that row (moves into Components · Activity once a variant is picked):
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
- [ ] F30 · Question · Keys for the thread's cursor and its actions (amber slot `sH3i5`, screen `E2nZW`): the key help
  (?) as a `Keyboard shortcuts` dialog over F24 with a `The thread` section: `[` `]`, ↓ ↑, PgDn PgUp, R, and the
  proposed `.` the comment's menu, `Q` Quote reply, `H` Resolve or unresolve, `W` Edit. The caption lists the keys
  checked free on the item and every screen sharing its keys: B G H Q W Y Z . ; (F is the workflows', V the review's).
- [ ] F31 · The comment's menu, opened by its key (slot `Htj0R`, screen `PjVCn`): `nS2AY` open under mlaine's current
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

- [ ] Review / Comment · current (`fNNF4`): the 2 px `$current-edge` mark on the card's left edge removed (the
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
- [ ] F24 (slot `mzLjU`, screen `VN5jy`): moved into the row `TS9ng`; `F24 · Variant A · The current comment, as the
  current file` → `F24 · The current comment, as the current file`; caption: picked by the owner, no mark on any edge
  and no caret, "see F25" → "see F27".
- [ ] F27 (slot `gkuKb`, screen `T2Mnvm`): moved into `TS9ng`; `F27 · Variant A · The cursor on every other kind of
  stop` → `F27 · The cursor on every other kind of stop`; caption: a comment in a code thread gets only the tint, no
  mark.
- [ ] Variants · How the reading cursor shows (`lTN61`, amber): deleted, with its head and the `Variant A` row
  (`O0Ijm`).
- [ ] F30 (slot `sH3i5`, screen `E2nZW`): `F30 · Question · Keys for the thread's cursor and its actions` → `F30 · Keys
  for the thread's cursor and its actions`; amber fill, stroke, padding and radius removed from the slot; caption: the
  keys are settled, E isn't used because it is code review's (expand hidden lines) and an item can be open over a
  review.
- [ ] F31 (caption `m67Kfj`): "both proposed in F30" → "F30"; "drawn in Variant A's look" → "the comment under the
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
