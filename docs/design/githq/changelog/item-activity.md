Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/aloof-dingo/githq.pen

The item thread on a rail (the owner picked Variant A; the other three directions were deleted), for pull requests and
issues alike. It replaces `Item / Activity` (`f9GRgL`, deleted) on every screen.

## The thread's parts

- [ ] App · Pull request (`XN8vf`): `Components · Activity` frame (`X7uA3I`) at the top holds every part of the thread,
  in rows: `Shared`, `Item thread`, `Writing`, `Editor, composer and menus` (`QgFYf`), `Composer states` (`DGsJK`),
  `Comments and reviews` (`rOA90`), `Thread parts` (`P9LTxZ`).
- [ ] The thread: one rail down the left, events one line on it, comments and reviews cards beside it. Avatars of
  whoever wrote something sit in a 40 px gutter (28 px avatar, gap 12), level with the card's 36 px head; cards start
  right of it. The rail is a 2 px `$border` line at x 55 (the centre of the event badges) that runs from the
  description card down to the composer card, joining them instead of passing through an icon. Only events have a
  badge on the rail. No “Activity” header above the thread.
- [ ] New `Avatar / large` (`gt0wc`): `Avatar` at 28 × 28, radius 14, initials 10.5.
- [ ] Item / Body (`bJhAe`) is the description, the first card of the thread: horizontal, gap 12; a 28 px rail with
  `Avatar / large`; a card like a comment (`$bg`, `$border-2`, radius 8) with a head (36, `$bg-2`, author 13 / 600
  `$fg`, “commented 2 days ago” 12 `$fg-dim`, an “Author” chip, ⋯) and content padded 14 16 16 16, gap 10. Text `$fg`
  13.5, line height 1.6. Hidden parts show how Markdown renders: a heading (14 / 600), a bullet list, and a
  “Closes #1188” line with the reference in `$accent`.
- [ ] `Activity / Event` (`umLcQ`): padding 4 0 4 42, gap 12; a 28 px badge (`$bg-3`, `$border`) with a 14 px icon,
  then one line: avatar, who (12.5 / 500 `$fg`), what (`$fg-2`), an optional label, a hidden `Ref` (`tDaJo`, 12.5 /
  500 `$accent`, “#15”, new) for a referenced issue, pull request or commit, the rest (wraps under itself), and the
  time at the right. With no person (CI, a Status change made by a project workflow) the avatar and who are
  hidden.
- [ ] `Activity / Comment` (`WHy4W`): avatar in the gutter (column 36 high), card with a 36 px `$bg-2` head (author
  13 / 600, “commented”, time, ⋯) and a body padded 14 16 16 16, text `$fg` 13.5, line height 1.6. Hidden parts: `Edited`
  (`X0iztw`, “· edited” after the time) and a `Failed` band (`I8YLPw`) at the bottom of the card: `#F851491A` fill,
  `#F8514959` top border, padding 8 10 8 14, a red circle-alert, “Not sent: GitHub can't be reached.” (12.5 `$fg`),
  Discard and Retry (`Button / medium`).
- [ ] `Activity / Push` (`lkjfC`): padding-left 42 so the badge sits on the rail; “mlaine pushed 3 commits”, then up
  to three `Activity / Commit` (`pbG2Y`) rows, then “Show N more commits” (`kt6I8`, `$accent`). A commit's message
  wraps under itself; the CI dot and the hash stay at the right.
- [ ] `Activity / Review` (`b1us0`): the reviewer's 28 px avatar in the gutter (the head's avatar is hidden), card
  with a 36 px head (author 13 / 600, verdict, time, “2 threads · 1 resolved”), body padded 14 16 16 16, gap 14: the
  summary (`ZCoSV`, `$fg` 13.5, line height 1.6), then each code thread, then the resolved threads folded. Hidden
  `Pending toolbar` (`TFpRb`, an instance of `Review / Pending toolbar`) at the bottom of the card.
- [ ] `Activity / Code thread` (`BGMhn`): one card (`$bg`, `$border-2`, radius 8): the code excerpt
  (`Activity / Code excerpt`, `VAMmB`) and the comments (padding 12, gap 10), then a `$bg-2` band with your avatar
  (the viewer: “ML” `#C9A26B` on these screens, was “MK”) and the “Reply…” field (R), then a band with a
  `Button / medium` “Resolve thread” (green check). Hidden `Resolved head` (chevron, check, “Resolved” 12.5 / 500,
  “Hide” `$accent` at the right) and hidden `Status` text next to the button.
- [ ] `Activity / Code thread · resolved` (`GlhsY`): resolved head on, the button reads “Unresolve” (rotate-ccw),
  followed by “mlaine marked this thread as resolved.”; the reply band stays.
- [ ] `Activity / Code thread · replying` (`phPkk`): “Reply…” opens `Activity / Editor` in the reply band, inside the
  card (Cancel with Esc, Reply with ⌘↵); it grows downwards and nothing above moves. Resolve stays below. The band's
  avatar is the viewer (“ML”, was “MK”) and the reply reads “And 4a1c9e2 adds a base in another repository to the e2e,
  so it can't come back.” (was a reply from another pull request).
- [ ] `Activity / Resolved threads` (`mrRDc`): a resolved thread folds by default into one clickable row: `$bg`,
  `$border-2` stroke, radius 8, height 40, padding 0 12, gap 8: chevron-right, green check, “Resolved” (12.5 / 500
  `$fg-2`), the file in `$mono` 11.5, the participants' avatars, “2 comments”, and “Show” in `$accent`. A hidden
  `Excerpt` (the comment's first line) replaces the file where the file is already known. It opens to
  `Activity / Code thread · resolved`. Activity / Review uses it.
- [ ] `Activity / Code comment` (`cwCtr`): a code thread posted on its own, without a review. Avatar in the gutter,
  then a 36 px head line, “dkim commented on src/store/schema.ts · 2d” (author 13 / 600 `$fg`, the file in `$mono`
  12), and the thread under it (gap 6), open and resolved. `Activity / Code comment · resolved` (`NXXMN`): the same
  with the thread folded into `Activity / Resolved threads`, showing the first line of the comment.
- [ ] `Activity / Fold` (`lshuQ`): a break in the rail with one clickable band. Padding 4 0 4 42, gap 12.
  `Rail break`: 28 × 48, `$bg-item` (it hides the solid rail), six 2 × 4 `$border` dashes 4 apart. `Band`, the whole
  of it the click target: `$bg-2`, `$border-2` stroke, radius 8, height 40, padding 0 14; an unfold-vertical icon and
  “Show 18 earlier events” (13 / 500 `$accent`), then what is folded, “10 commits · 3 comments · 5 other events”
  (12 `$fg-dim`, an icon each), and a chevron at the right.
- [ ] `Activity / Fold · narrow` (`SeqKu`), for the side panel: the same with the band on two lines (“Show 18 earlier
  events” and the chevron, then the counts) and a 64 px rail break with eight dashes.
- [ ] `Activity / New since you looked` (`t2x5CU`): “3 new since you looked” (12 / 600 `$accent`) and an accent rule,
  indented 40.
- [ ] `Button / medium` (`TH5d7`), the size of the merge box's buttons: padding 5 8 5 10, radius 6, `$bg-3` with a
  `$border-2` stroke, icon 13, label 12.5 / 500, key. `Button / medium · primary` (`t0PlX5`): `$accent`, label
  `#0D1117`, no icon.
- [ ] New `Button / medium · menu` (`L4s15U`): the same button with a 1 × 14 `$border-2` divider and a chevron-down
  after the key, for a button with a menu: “Close issue” (purple circle-check, ⇧X).
- [ ] `Activity / Editor` (`OXAXr`), the one Markdown editor (the composer, a reply, editing a comment): `$bg-2`,
  `$border-2`, radius 8. Head 38, `$bg-2`, bottom border, padding 6 10 0 8, aligned to the bottom: Write / Preview are
  classic tabs; the current one is `$bg` with a `$border` top, left and right border, top corners 6, padding 0 14,
  full height, so it opens into the text area; the other has no fill or border, `$fg-dim` text (both tabs now have
  the same shape, `IvDOQ` got the radius and the border widths). Then the tools: heading, bold, italic, code, link |
  lists, task list, quote | @ and #. The paperclip (attach) is removed: GitHub has no public upload API. A text area
  that grows from about 70 px, and a footer with “Markdown” and two `Button / medium`s. A hidden `Rendered` block
  (`Ssyf3`) in the text area shows the preview: paragraphs in `$fg` 13, a mention in `$accent` 600.
- [ ] New `Activity / Editor · preview` (`pAVb7`): Preview is the current tab, the tools are hidden, the text area
  shows `Rendered`.
- [ ] `Activity / Composer` (`sWprg`): the last item on the rail, the viewer's avatar (“ML” `#C9A26B`, was “MK”
  `#D2A8FF`) and `Activity / Editor` with Close pull request (⇧X) and Comment (⌘↵, dimmed while empty). Focused, the
  editor gets an accent border. Nothing is pinned to the bottom of an item view: R, or “Comment” in the command menu,
  scrolls to the composer and focuses it.
- [ ] `Activity / Composer · writing` (`G3hGNp`): text typed, accent border, Comment active, and the close button reads
  “Close with comment” (was “Close pull request”).
- [ ] New composer states, variants of `Activity / Composer` unless said otherwise:
  - `Activity / Composer · issue` (`AljH1`): the close button is `Button / medium · menu`, “Close issue” (⇧X closes as
    completed, the chevron opens `Activity / Close menu`).
  - `Activity / Composer · issue, writing` (`G7spc`): text typed, accent border, “Close with comment”.
  - `Activity / Composer · closed` (`BWMUY`): “Reopen issue” with a green circle-dot (⇧X); on a pull request “Reopen
    pull request”.
  - `Activity / Composer · merged` (`yL1Bq`): no close button.
  - `Activity / Composer · preview` (`d7Rk1Q`): the editor is `Activity / Editor · preview`.
  - `Activity / Composer · read-only` (`fBQzF`, new frame): the avatar and, instead of the editor, one `$bg-2` card
    (`$border-2`, radius 8, padding 11 14): a lock icon and “This conversation is locked to collaborators, so you can
    read it but not comment.” (12.5 `$fg-2`). For an archived repository the icon is archive and the line says so.
- [ ] New `Activity / Comment · sending` (`OmV5q`): the new card in the thread right after Comment, the card at 60 %
  opacity, “Sending…” for the time. New `Activity / Comment · failed` (`a4VAuV`): “Not sent” in `$red`, the card's
  border `#F8514980`, the `Failed` band on.
- [ ] New `Activity / Comment · editing` (`ehuxk`, a variant of the composer): the comment's card becomes the editor in
  place, with the comment's text, an accent border, Cancel (Esc) and Update comment (⌘↵).
- [ ] New menus, drawn as popovers (`$bg-2`, `$border-2`, radius 9, padding 4, shadow `#000000A0` 0 12 32), from
  `Activity / Menu item` (`vC9fN`: radius 5, padding 5 8, gap 9; icon 14 `$fg-2`, a hidden avatar, label 13 `$fg`, a
  hidden sub-label 12.5 `$fg-dim`, a hidden key) and `Activity / Menu item · selected` (`m8UXn`, `$sel`):
  - `Activity / Close menu` (`PRnLo`): Close as completed (purple, ↵), Close as not planned. No Close as duplicate:
    it needs an issue picker, so it comes later.
  - `Activity / Comment menu` (`nS2AY`): Edit, Quote reply, Copy link, a rule, Delete… in `$red`.
  - `Activity / Mention menu` (`w5xhn`), 280 wide: “People”, then avatar, login and name per row.
  - `Activity / Reference menu` (`eKbTa`), 480 wide: “Issues and pull requests in mlaine/tasklet”, then a state
    icon, the number in `$mono` and the title per row.
- [ ] New review variants of `Activity / Review`:
  - `Activity / Review · approved` (`I99H9c`): dkim, “approved” in `$green`, a summary, no threads.
  - `Activity / Review · commented` (`YKqKB`): “reviewed” in `$fg-dim`, a summary and one thread opened by dkim.
  - `Activity / Review · commented, no summary` (`DwBhj`): the same without the summary.
  - `Activity / Review · dismissed` (`d5GG0`): “requested changes · dismissed” in `$fg-dim`, the body hidden, “Show
    review” in `$accent` at the right of the head.
  - `Activity / Review · pending` (`PwdqU`): “Your review”, “pending” in `$amber`, the card's border `#D2992280`, one
    code thread whose comment is marked “Pending”, no reply or resolve bands, and the pending toolbar on (“1 pending
    comment · Only you can see them.”, Discard review…, Submit review… ⇧S).
- [ ] New `Activity / Code thread · outdated` (`Tc0aE`): the excerpt's “Outdated” mark (amber history icon) on.
- [ ] New `Activity / Thread · short` (`uKgRc`): an event and two comments, the thread drawn on screens that are about
  something else.
- [ ] New `Activity / Thread · loading` (`FZHVU`): on the rail a badge with loader-circle and “Loading 4 comments and 6
  events from GitHub” (12.5 `$fg-dim`), then a skeleton event, a skeleton comment card and another skeleton event
  (`$bg-3` circles and bars).
- [ ] New `Activity / Thread · failed` (`V75cQv`): a badge with an amber cloud-off on the rail and a `$bg-2` card
  (`$border-2`, radius 8, padding 10 14 12 14, gap 10): “The comments and events couldn't be loaded” (12.5 / 500),
  “GitHub can't be reached. The description above is from this device.” (12 `$fg-dim`), then Try again and Open on
  GitHub (`Button / medium`).
- [ ] Comment and review summary text in the thread: `$fg` (was `$fg-2`), 13.5, line height 1.6.
- [ ] Text links that do something are `$accent` (were `$fg-dim` or `$fg-2`): “Show N more commits” (`kt6I8`), “Show
  the whole description” in Review / Conversation (`c05P2`), “Hide” on a resolved code thread (`V3M4mU`), “Log” and its
  arrow in Item / Checks (`ujCTy`, `SQWpM`, `DiElt`, `VTG3K`), “Request” in Item / Reviews (`pu5lX`).
- [ ] New variable `bg-item` = `#11161C`: the background of an item view, between the list's `$bg` and `$bg-2`, which
  it replaces on every item-view container (23): Item view / stacked (`jOPlc`), Item view / split (`a80hmX`), Item
  view / PR panel (`pX8Wm`) and every `PR view (full page)` / `PR view (panel)` / modal PR view.
- [ ] Reading width: on the full page the main column's content is at most 760 px wide, centred (the five full-page
  `Main column`s of App · Pull request get horizontal padding 142, was 40). The modal's column is about 680 of
  content; the panel is 512.

## The thread on every item view

- [ ] `Item / Composer` (`oBw7q`) is deleted, and so are the panels' `Composer dock`s. `Item / Activity` (`f9GRgL`) is
  deleted. On each of its 24 uses (the item views `Item view / stacked` `jOPlc`, `Item view / split` `a80hmX`,
  `Item view / PR panel` `pX8Wm`, and 21 pull request screens in App · Pull request, App · Item menu, App · States,
  App · Merging a pull request, App · Stacked pull requests and App · Code review) the description, the activity and the
  composer now sit together in a `Thread` frame: horizontal, padding-left 55, gap -57, with a 2 px `$border`
  `Rail line` (height fill) first and an `Items` frame (vertical, gap 16) holding `Item / Body`,
  `Activity / Thread · short` and the composer. The rail runs behind the cards, from the description to the composer.
  Each screen keeps its two comments (author, time, text); on a pull request the event reads “mlaine asked sofiab for a
  review · 1d”, on an issue “mlaine added bug and assigned dkim · 3d”. `Item view / PR panel` had no composer and gets
  one. Nothing pinned to the bottom of an item view, no `flex` spacer.
- [ ] Item view / stacked (`jOPlc`) and Item view / split (`a80hmX`), the issue item views of D1–D3 and every list
  screen: the composer is `Activity / Composer · issue` (was the pull request one), and the description is dkim's,
  “commented 3 days ago”, like the title (was mlaine's, 2 days ago).
- [ ] App · Freshness, “3d · List fresh, item's comments still loading” (`d6TZng`): the thread is
  `Activity / Thread · loading` (was a hand-drawn “Activity · loading” skeleton).

## Pull request screens (App · Pull request)

- [ ] F5 · PR full page · the thread (`Hqwu7`): the thread on the full page. Its order, all chronological: description
  (4 days ago), mlaine pushed 6 commits (4d), mlaine added storage and asked sofiab and dkim for a review (4d), the fold
  (18 earlier events), sofiab's review (2d, one open thread and one resolved), dkim's code comment, resolved (2d,
  moved up from after dkim's comment), mlaine pushed 3 commits (1d), CI: 2 of 9 checks failed on e81f0a3 (1d), dkim's
  comment (1d), “2 new since you looked”, mlaine asked sofiab for another review (3h), mlaine's comment (2h), the
  composer. The “mlaine opened this pull request” event is gone (the description card is the opening). The title
  reads “mlaine · opened 4 days ago” and the description “commented 4 days ago” (were 2 days). Screen height 1959.
- [ ] F5's caption gains three rules:
  - The fold: a thread folds once it has more than 20 items (events, pushes, comments, reviews; not the description or
    the composer). The first 2 items stay above it. Below it stays everything from the earliest of: the 5th item from
    the end, the first item new since you looked, and the oldest review or code comment with a thread still
    unresolved. If fewer than 6 items would fold, nothing folds.
  - New since you looked: counted from the last time you had the item open, in any container, kept per item on this
    device (a rebuildable cache; on a new device nothing is marked). Your own comments, reviews and events count as
    looking, so they are never new. The line sits before the first item by someone else after that moment and stays
    until you leave the item.
  - R: with a code thread focused (J/K, or clicked) R opens that thread's reply box; otherwise R scrolls to the composer
    and focuses it, as “Comment” in the command menu does.
- [ ] F9 · PR in panel · the thread (`r9heB`): the same thread in the 560 px panel, with `Activity / Fold · narrow`.
  The description is this pull request's (“Moves issues, pull requests and project items into IndexedDB…”, was an
  issue's), 4 days ago; the title says 4 days; no “opened this pull request” event.
- [ ] F10 · PR full page · replying in a thread (`ToA4h`): a reply being written in the review's code thread (its text
  now about this pull request), and the resolved thread opened. Same order and times as F5, no “opened” event. Screen
  height 2303.
- [ ] F11 · PR in panel · writing a comment (`VNBoD`): the panel scrolled to the end, with a comment being written
  (“Close with comment”).
- [ ] F12 · A resolved thread, folded and open (`pqJ1l`): a resolved thread folded and open, in a review (top) and on
  its own (bottom).
- [ ] Rail line on F5, F9, F10 and F11 runs from the description card to the composer's avatar.
- [ ] New F13 · Every event in the thread (`U9JZ1`): every timeline event githq shows, as `Activity / Event`s, with a
  chip saying what each counts as in a fold (“commits”, “other events”) and “issues too” where an issue has it. Left,
  pull request: pushed (drawn as Activity / Push), force-pushed, assigned, unassigned, renamed, labeled, unlabeled,
  milestoned, demilestoned, review requested, review request removed, review dismissed, ready for review, converted to
  draft, base changed, cross-referenced, checks failed, closed, reopened, merged, branch deleted, and a merged line.
  Right, issue only: closed as completed, closed by a merged pull request (“closed this as completed in #15”), closed
  as not planned, closed as a duplicate, reopened, linked a pull request, referenced in a commit, sub-issue added,
  sub-issue removed, parent set, type changed, added to a project, Status changed (“mlaine changed Status to In
  progress in tasklet Roadmap”), Status changed, automated (no person: “Status set to Done in tasklet Roadmap by a
  project workflow”), transferred, locked, unlocked, pinned, unpinned. “mentioned this in” is listed once, on the left,
  marked “issues too”. Of a project GitHub reports only Status changes (`ProjectV2ItemStatusChangedEvent`), with the
  person who made them; one made by a project workflow (`wasAutomated`) shows no person. The caption says so. Rules
  above the lists:
  - One line per burst: events by one person, straight after each other and within 10 minutes, share one line (the
    first event's badge, the newest time, “and” between the parts: “added storage and asked sofiab and dkim for a
    review”). Events of one kind merge their objects; an add and a remove of the same thing cancel out. Comments,
    reviews, code comments and pushes never merge.
  - CI, failures only: the event appears once the checks on a pull request's newest commit finish with at least one
    failed. Passing or running checks add nothing (the commit's dot shows them), nor does a later green run.
  - In a fold: commits (the commits of the pushes), comments (comments, reviews, code comments), other events (every
    event on this screen, a merged line once).
  - Never shown: subscribed, unsubscribed, mentioned, deployments, comment deleted, and automatic events with no
    person except CI and an automated Status change.
- [ ] New F14 · Reviews in the thread (`l01YB`): approved, commented with and without a summary, dismissed (folded,
  followed by “mlaine dismissed sofiab's review: Addressed in 3f2a9b1”), your pending review (at the end of the thread,
  above the composer; only you see it), and an outdated code thread on its own.
- [ ] New F15 · A comment's ⋯ menu, and editing in place (`BLYpR`): the menu open on your own comment (from ⋯ or a right
  click), the comment being edited in place, the saved comment with “· edited”, and someone else's comment where you
  can't write: Quote reply and Copy link only. Delete… asks once. The description card has the same menu without
  Delete.
- [ ] New `Activity / Comment · editing, discard?` (`BVHXx`, a variant of `Activity / Comment · editing`): leaving an
  edit whose text was changed asks in the editor's footer first, as code review's CR97 does: an amber circle-alert and
  “Discard your changes to this comment?” (`$fg`) where “Markdown” was, then Keep editing (Esc) and Discard (↵,
  `#DA3633` fill — Primer's red emphasis, so the white label reaches AA). Esc, Cancel, J / K, opening another item and
  closing the item ask; Esc again keeps editing; an unchanged edit closes without a question. F15 (`BLYpR`) gains a
  third row showing it (`u1CA8R`), and its caption says so.
- [ ] New F16 · The thread loading, empty, or not loaded (`Q2H7SU`): three columns at panel width. Loading the first
  time: the description and the composer are there, the rail shows how many items GitHub reported and a skeleton;
  later opens come from the local copy with no skeleton. Empty: the rail runs from the description straight to the
  composer. Not loaded: `Activity / Thread · failed` on the rail; what is there stays.
- [ ] F16 (`Q2H7SU`) corrected to what an item's detail holds: the description comes with the comments and events, not
  with the item's row, so before the first read none of them is on the device. Loading and Not loaded hide the
  description card (`C7P6R`, `Pflvp`); the loading skeleton's first card stands for it. `Activity / Thread · failed`
  (`V75cQv`) reads “The description, comments and events couldn't be loaded” and “GitHub can't be reached, so they
  aren't on this device yet.” (was “The comments and events couldn't be loaded” and “… The description above is from
  this device.”). The caption says so, and that a read failing later changes nothing on screen.
- [ ] `Activity / Thread · loading` (`FZHVU`): the line reads “Loading 4 comments and the events from GitHub” (was “…
  and 6 events…”): before the detail arrives the item's row knows how many comments it has, not how many events.
- [ ] Captions brought in line with what was built (2026-11-10):
  - F13 (`U9JZ1`) “One line per burst” (`fdTFK`): objects of one kind merge in the order the kinds first came; one keeps
    its title, several show references only (“mentioned this in #14, #15, and #16”); one author's commits in a row are
    one push, split where more than an hour passed between two of them (GitHub gives no push time).
  - F13 “CI, failures only” (`n0ntVn`): “CI” where a person would be, no avatar; only the newest run of each check
    counts, and a cancelled run is not a failure.
  - F13 “In a fold” (`F5ti1`): the counts are GitHub's own, the close that comes with a merge is not an event of its
    own. F13's caption (`HADwB`): “marked as a duplicate” is not shown, the close says it.
  - F5's caption (`s4L7N6`), the fold: everything stays in time order; what GitHub hasn't given yet, of the comments or
    of the events, folds with the middle; expanding reads it and puts it in place.
  - F15's caption (`o9BXr`): Discard after J / K, another item or closing goes where you were going; Update description
    on the description; a refused edit gives a toast and opens the editor again; Copy link is quiet.
  - I4's caption (`L5oEi3`): ⇧X and the item menu's close also post the typed comment first; a comment not sent has no
    toast, its card says it; @ lists the thread's people first, # the repository's items from this device when tracked,
    else GitHub's search once typing pauses, never the item itself; the suggestion list stays inside the item; in a
    modal the first Esc leaves the box, the next closes the item.

## Issue screens (new frame App · Issue, `xO0zP`, codes I)

- [ ] New top-level frame `App · Issue` (`xO0zP`), right of App · Pull request, with its own letter I.
- [ ] I1 · Issue full page · the thread (`ugRqZ`): open issue mlaine/tasklet#12 “Sub-issue links are lost when the
  parent is in another repository”, dkim, 6 days ago, on the full page at reading width, no Reviews section. The
  thread: dkim added bug and set the type to Bug (one line), added to parent #9, added to tasklet Roadmap, “mlaine
  changed Status to Todo in tasklet Roadmap”, sofiab's comment, self-assigned, added sub-issue #13, “mlaine changed
  Status to In progress in tasklet Roadmap”, removed sub-issue #10, linked pull request #15, referenced in commit 4a1c9e2, mentioned in #14, “2 new since
  you looked”, dkim's comment, pinned. 14 items, so nothing folds. Composer: `Activity / Composer · issue`.
- [ ] I2 · Issue in panel · closed by a merged pull request (`OrT0n`): the same issue in the panel after #15 merged,
  scrolled to the end: two items, the narrow fold (“Show 15 earlier events · 2 comments · 13 other events”), dkim's
  comment, “4 new since you looked”, “mlaine closed this as completed in #15”, “Status set to Done in tasklet Roadmap
  by a project workflow” (automated, so no person), unpinned, sofiab's comment. The title says Closed in purple.
  Composer: `Activity / Composer · closed`. The list's selected row (`Z9BxYw` in the list pane) is this issue:
  purple circle-check, “Sub-issue links are lost when the parent is in another repository”, mlaine/tasklet#12, mlaine's
  avatar, Done, 5m (was fitloop/webapp#1187).
- [ ] I3 · Issue in modal · not planned and locked (`NVC4S`): mlaine/tasklet#16 “Parent links break after a transfer”
  by sren-dev, the viewer (a contributor; the sidebar's account avatar is sren-dev's, “SR” `#E8A87C`, was mlaine's).
  The thread: sren-dev's description (`Item / Body`, “commented 3 days ago”), transferred from mlaine/tasklet-mobile,
  closed as a duplicate of #12, sren-dev's comment, reopened, mlaine's comment, then one merged line “closed this as
  not planned and locked the conversation to collaborators”. The title says Closed in `$fg-2` with circle-slash.
  Composer: `Activity / Composer · read-only`, with sren-dev's avatar. The modal is 780 high at y 60 (was 700 at y 100)
  so the whole thread fits.
- [ ] I4 · The composer's states (`OGRTF`): issue closing with a reason (the close menu open under the button), issue
  with text typed, closed issue and closed pull request (Reopen), merged pull request, locked and archived (read-only),
  Preview, @ typed (the mention menu at the caret), # typed (the reference menu), a sent comment (the sending card and
  an empty composer) and one that wasn't sent (the failed card). In the menus ↑↓ move, ↵ or Tab inserts, Esc closes.
  The caption says Close as duplicate is left out of the reasons for now: it needs an issue picker, so it comes later.
