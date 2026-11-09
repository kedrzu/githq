Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/groovy-moth/githq.pen

The owner picked the rail (Variant A); the other three directions were deleted. `Item / Activity` (`f9GRgL`) on the
other screens still draws the old thread, until it is replaced by this one.

- [ ] App · Pull request (`XN8vf`): new `Components · Activity` frame (`X7uA3I`) at the top, with the parts of the item
  thread: `Activity / Code excerpt` (`VAMmB`), `Activity / Commit` (`pbG2Y`), `Activity / Fold` (`lshuQ`),
  `Activity / New since you looked` (`t2x5CU`), `Activity / Code thread` (`BGMhn`), `Activity / Event` (`umLcQ`),
  `Activity / Comment` (`WHy4W`), `Activity / Push` (`lkjfC`), `Activity / Review` (`b1us0`).
- [ ] The thread: one rail down the left (a 2 px `$border` line through 28 px badges); events are one line on it,
  comments and reviews are cards with a header strip (`$bg-2`) beside it; a push lists three commits, then “Show N
  more commits”; a review card holds its summary, each code thread with the lines it is about, and resolved threads
  folded to one line; a long middle folds to “N earlier events”; an accent line marks “N new since you looked”.
- [ ] F5 · PR full page · the thread (`Hqwu7`, new screen): the thread on the full page.
- [ ] F9 · PR in panel · the thread (`r9heB`, new screen): the same thread in the 560 px side panel. An event's text
  and a commit's message wrap under themselves, the time and the hash stay at the right edge, a code excerpt keeps
  its width and scrolls sideways inside its frame.
- [ ] Activity / Code thread (`BGMhn`, replaces `Rd26J`): one card as on GitHub (`$bg`, `$border-2` stroke, radius
  8): the code excerpt and the comments (padding 12, gap 10), then a `$bg-2` band with your avatar and the “Reply…”
  field (R), then a band with a real `Button / medium` “Resolve thread” (green check). Hidden `Resolved head`
  (chevron, check, “Resolved”, “Hide”) and hidden `Status` text next to the button.
- [ ] New `Activity / Code thread · resolved` (`GlhsY`): resolved head on, the button reads “Unresolve” (rotate-ccw),
  followed by “mlaine marked this thread as resolved.”; the reply band stays.
- [ ] New `Activity / Resolved threads` (`mrRDc`): resolved threads are folded by default into one quiet line
  (“1 resolved thread · src/store/schema.ts”); it opens to `Activity / Code thread · resolved`. Activity / Review
  (`b1us0`) uses it instead of `Review / Thread · resolved`.
- [ ] New `Activity / Editor` (`OXAXr`): the one Markdown editor, used by the comment at the end of the thread and by a
  reply in a code thread. Write / Preview tabs, the tools, a text area that grows from about 70 px, a footer with
  “Markdown” and two `Button / medium`s.
- [ ] New `Activity / Code thread · replying` (`phPkk`): clicking “Reply…” opens `Activity / Editor` in the reply band,
  inside the card (Cancel with Esc, Reply with ⌘↵); it grows downwards and nothing above moves. Resolve stays below.
- [ ] New `Button / medium` (`TH5d7`): the size of the merge box's buttons (Primary Merge `SRALN`): padding 5 8 5 10,
  radius 6, `$bg-3` with a `$border-2` stroke, icon 13, label 12.5 / 500, key. New `Button / medium · primary`
  (`t0PlX5`): its instance filled with `$accent`, label `#0D1117`, no icon. Cancel / Reply in the reply box and Close
  pull request / Comment in the composer use them.
- [ ] New `Activity / Composer` (`sWprg`) and `Activity / Composer · writing` (`G3hGNp`): the last item on the rail,
  your avatar and `Activity / Editor` with Close pull request (⇧X) and Comment (⌘↵, dimmed while empty). Focused,
  the editor gets an accent border. Nothing is pinned to the bottom of the item any more: R, or “Comment” in the
  command menu, scrolls to the editor and focuses it.
- [ ] `Item / Composer` (`oBw7q`) is deleted, and nothing is pinned to the bottom of an item view any more. Every one of
  its 24 uses now has `Activity / Composer` right after the item's activity, scrolling with it: the 11 main columns
  (their `flex` spacer is gone too) and the 13 `Composer dock`s of the panels (deleted), including Item view /
  stacked (`jOPlc`), Item view / split (`a80hmX`) and Item view / PR panel (`pX8Wm`).
- [ ] F5 (`Hqwu7`): screen height 1500 → 1660 to show the composer.
- [ ] F10 · PR full page · replying in a thread (`ToA4h`, new screen): a reply being written in the code thread's reply band,
  and the resolved thread opened.
- [ ] F11 · PR in panel · writing a comment (`VNBoD`, new screen): the panel scrolled to the end, with a comment being
  written.
- [ ] Activity / Editor (`OXAXr`): Write / Preview are classic tabs. The head (38, `$bg-2`, bottom border `$border`)
  has padding 6 10 0 8 and aligns to the bottom. The current tab is `$bg` like the text area, with a `$border` top,
  left and right border (no bottom), top corners 6, padding 0 14, full height, so it opens into the text area; the
  other tab has no fill or border, `$fg-dim` text.
- [ ] Item / Activity (`f9GRgL`): each comment row gets padding-left 4 and gap 16 (was 0 and 10), so its avatar lines
  up with the composer's avatar on the 28 px rail and the text with the composer's card.
- [ ] Rail line on F5, F9, F10 and F11 ends at the composer's avatar.
- [ ] Text links that do something are `$accent` (were `$fg-dim` or `$fg-2`), so they read as clickable: “Show N more
  commits” in Activity / Push (`kt6I8`), “Show all 4” in Item / Activity (`gYDqf`), “Show the whole description” in
  Review / Conversation (`c05P2`), “Hide” on a resolved code thread (`V3M4mU`), “Log” and its arrow in Item / Checks
  (`ujCTy`, `SQWpM`, `DiElt`, `VTG3K`), “Request” in Item / Reviews (`pu5lX`). “Show” in Activity / Fold already
  was.
- [ ] New variable `bg-item` = `#11161C`: the background of an item view, between the list's `$bg` (`#0D1117`) and
  `$bg-2` (`#151B23`), which it replaces on every item-view container (23): Item view / stacked (`jOPlc`), Item
  view / split (`a80hmX`), Item view / PR panel (`pX8Wm`) and every `PR view (full page)` / `PR view (panel)` /
  modal PR view. Cards and their `$bg-2` heads now stand out from it.
- [ ] Reading width: on the full page the main column's content is at most 760 px wide, centred. On the canvas the
  five full-page `Main column`s (1044 wide) get horizontal padding 142 (was 40). The modal's column is already
  narrower (about 680 of content); the panel is 512.
- [ ] New `Avatar / large` (`gt0wc`): `Avatar` at 28 × 28, radius 14, initials 10.5.
- [ ] Item / Body (`bJhAe`) is the description as the first card of the thread: horizontal, gap 12; a 28 px rail with
  `Avatar / large` (centred on the 36 px head); a card like a comment (`$bg`, `$border-2`, radius 8) with a head
  (36, `$bg-2`, author 13 / 600 `$fg`, “opened this · 2 days ago”, an “Author” chip, ⋯) and content padded
  14 16 16 16, gap 10. The text is brighter and larger: `$fg` (was `$fg-2`), 13.5 (was 13), line height 1.6.
  Hidden parts show how Markdown renders: a heading (14 / 600), a bullet list, and a “Closes #1188” line with the
  reference in `$accent`; F5 and F10 turn them on.
- [ ] Comment and review summary text in the thread (Activity / Comment `BujgM`, Activity / Review `ZCoSV`): `$fg`
  (was `$fg-2`), 13 (was 12.5), line height 1.6.
- [ ] F5 height 1660 → 1867 and F10 1660 → 2322, to show the whole thread at the narrower width.
- [ ] The thread is laid out as on GitHub. Avatars of whoever wrote something sit in a 40 px gutter on the left (28 px
  avatar, gap 12), level with the card's head; cards start right of it. The rail is a 2 px `$border` line at x 55
  (the centre of the event badges) that runs from the description card down to the composer card, so it joins the
  cards top and bottom instead of passing through an icon of theirs. Only events have a badge on the rail.
  - Activity / Event (`umLcQ`) and Activity / Push (`lkjfC`): padding-left 42, so the badge sits on the rail.
  - Activity / Comment (`WHy4W`) and Activity / Composer (`sWprg`): the avatar is 28 px, its column 36 high so it
    lines up with the 36 px head; comment head 36 high, author 13 / 600, body padding 14 16 16 16, text 13.5.
  - Activity / Review (`b1us0`): the red file-diff badge is gone; the column holds sofiab's 28 px avatar, the avatar
    in the card's head is hidden; head 36, author 13 / 600; body padding 14 16 16 16, summary 13.5.
  - Item / Body (`bJhAe`) reads like any other comment: “mlaine commented 2 days ago”.
  - The “Activity” header above the thread is hidden on F5, F9, F10 and F11 (it cut the rail); F9 shows the
    description above the thread again.
- [ ] Activity / Fold (`lshuQ`) is a break in the rail with a clickable band, no longer a line of small text between
  two rules. Padding 4 0 4 42, gap 12. `Rail break`: 28 × 48, `$bg-item` (it hides the solid rail), six 2 × 4
  `$border` dashes 4 apart, so the rail carries on dashed. `Band`, one line, the whole thing is the click target:
  `$bg-2`, `$border-2` stroke, radius 8, height 40, padding 0 14; an unfold-vertical icon and “Show 18 earlier
  events” (13 / 500, `$accent`), then what is folded, “10 commits · 3 comments · 5 other events” (12, `$fg-dim`,
  an icon each), and a chevron at the right. Its `Indent` wrapper on F5, F9 and F10 has no padding any more.
- [ ] New `Activity / Fold · narrow` (`SeqKu`), for the side panel: the same, with the band on two lines aligned left
  (“Show 18 earlier events” and the chevron, then the counts) and a 64 px rail break with eight dashes. F9 uses it.
- [ ] Activity / Resolved threads (`mrRDc`), the folded resolved thread, is a clear clickable row: `$bg`, `$border-2`
  stroke, radius 8, height 40, padding 0 12, gap 8: chevron-right, green check, “Resolved” (12.5 / 500 `$fg-2`),
  the file in `$mono` 11.5, the participants' avatars, “2 comments”, and “Show” in `$accent`. The hidden `Excerpt`
  is there for wide views. Open, the thread's `Resolved head` reads “Resolved” (12.5 / 500) with “Hide” at the right.
- [ ] F12 · A resolved thread, folded and open (`pqJ1l`, new): the review card twice, the resolved thread folded and
  open. F5 1908 → 1913, F10 2363 → 2347.
- [ ] New `Activity / Code comment` (`cwCtr`): a code thread posted on its own, without a review, as an item of the
  thread. Avatar in the 40 px gutter (28 px, column 36 high), then a 36 px head line, “dkim commented on
  src/store/schema.ts · 2d” (author 13 / 600 `$fg`, the file in `$mono` 12), and the thread under it (gap 6). Open
  and resolved it holds `Activity / Code thread · resolved`. New `Activity / Code comment · resolved` (`NXXMN`):
  the same with the thread folded into `Activity / Resolved threads`, showing the first line of the comment
  instead of the file. F5 has one, folded, after dkim's comment.
- [ ] F12 (`pqJ1l`) now shows a resolved thread folded and open twice: in a review (top) and on its own (bottom).
