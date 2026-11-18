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
