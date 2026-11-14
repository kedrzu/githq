# The phone in line with the desktop

The phone design (`App · Mobile`, `jy6bO`, codes `MB`) was drawn before the desktop's item thread landed. This log
brings it back in line: the owner's picks of 2026-11-14 settled (D49, MB173, MB97) and the phone's item thread made
of the desktop's own `Activity / *` parts in their narrow layout (D50), with the thread's states drawn as phone
screens. Base: `50220f18`.

## Round 1 · agent brief

Asked (`.context/mobile-thread-brief.md`): settle D49's variants and the Empty groups question; replace the phone's
old activity list with the desktop's thread on every phone item; new screens for the thread's states.

Changed: MB222–MB224 moved out of their Variants frame and MB225 deleted; the Empty groups row gone from the options
sheet; MB173 and MB97 settled. A new `The thread` section in `Components · Mobile` holds no-gutter variants of the
desktop's rail parts, two narrow cards the desktop lacked, the comment menu and the `Phone / Thread` family; every
phone item pane now draws its thread from them and the old activity components are deleted. Ten new screens,
MB226–MB235, in a new row `Row · The thread`.

Decisions taken in this round:

- The desktop's rail parts (event, push, fold, loading, failed) keep a 42 px left padding for the gutter avatar. On a
  phone the narrow cards have no gutter, so these parts got `· no gutter` variants with 2 px instead, and the rail
  runs 16 px in from the card edge, as on the desktop.
- The description card hides its Author chip, as on the desktop's I1.
- The pull request panes (#1205, opened 20 min ago) had shown the issue's thread with comments older than the pull
  request. Their thread is now the pull request's own: its description, mlaine's push of a3f91c2, the review request
  to dkim, and sbrandt's comment moved to 10 min ago.
- MB97 is scrolled to the end, as the desktop's I2 is, so the fold, the new-since line and the newest items are in
  view. The earlier review's four threads are folded to its "4 threads · 4 resolved" line. The "3 new" pill is gone
  because the desktop has none.
- `Activity / Comment · narrow, editing, discard?` reads "Discard your changes?" and drops the Esc and ↵ chips. The
  desktop's sentence and chips don't fit a card under 360 px; the narrow not-sent card drops its chips too.
- The thread's state screens use items already in the file: loading on #1201 (MB98's pull request), empty on the
  draft #1209 (MB99), failed on #290 (MB95).

Settling the owner's picks:

- [ ] Row · A changed project view (`bEY9X`): new row in `Screens · Lists and new issue`, after `Row · Created, and
  drafts`.
- [ ] MB222 (`B3AIHc`, screen `S82jM`), MB223 (`PtoUJ`, `p2Pc6D`), MB224 (`CR021`, `uWIPq`): moved into it;
  `Variant A · ` dropped from slot, screen and caption names (`Ga1Gx`, `BjLCm`, `UMV3X`); "Recommended." dropped from
  their notes (`d4KNL`, `IrorN`, `swzBA`).
- [ ] MB225 · Variant B · A strip under the top bar (`r4SINY`): deleted.
- [ ] Variants · Where a changed project view is marked (`Oi2Nq`): deleted.
- [ ] Phone / Sheet / View options (`BcxyQ`): the `Empty groups` row (`KwOQp`) deleted, so it is gone from MB173,
  MB224 and every list options sheet; the override hiding it on `txdRW` removed.
- [ ] MB206's caption (`Hs41m`): "Empty groups is gone until something is grouped." removed.
- [ ] MB173 (`s3IZJ`, screen `ffCro`, title `n662Oc`): `Question · ` and the amber dropped; the question removed from
  the note (`VnUCy`).
- [ ] MB97 (`N6uRDK`, screen `RnDn2`, title `ZyJ4c`): `Question · ` and the amber dropped; note (`DFcul`) rewritten
  for the desktop's fold and new-since line; the `3 new` pill holder (`u6U8h`) deleted.

Components (`Components · Mobile`, `F3mZHt`, new section `The thread`, `tkeG6`):

- [ ] Activity / Event · no gutter (`W3NY8`), Activity / Fold · narrow, no gutter (`S8sSel`), Activity / Push · no
  gutter (`dsBwi`), Activity / Thread · failed, no gutter (`HI7L7`): new, instances of `umLcQ`, `SeqKu`, `lkjfC`,
  `V75cQv` with left padding 42 → 2.
- [ ] Activity / Thread · loading, no gutter (`UActV`): new, instance of `FZHVU`. Its rows' padding is 42 → 2, the
  skeleton card's rail is hidden and its bars fit the narrow card.
- [ ] Activity / Comment · narrow, editing, discard? (`SSKJn`): new, instance of `BVHXx`. Like `DFWqj`, it has no
  gutter and folded tools; the hint reads "Discard your changes?" and wraps, and the key chips are hidden.
- [ ] Activity / Comment · narrow, linked (`Kt0hV`): new, instance of `iMK9U` with the narrow head.
- [ ] Phone / Menu / Comment (`Hvbw2`): new, instance of `Phone / Menu`, no search. Entries: Edit, Quote reply, Copy
  link, Delete… (red), as in `Activity / Comment menu`.
- [ ] Phone / Thread (`ShZ5Q`): new, 390 px, 16 px sides. The feed holds the rail line, then #1187: dkim's
  description, sbrandt's comment, mlaine's commit a3f91c2, mlaine's comment. A hidden reply of mlaine's (`PTknx`)
  ends it.
- [ ] Phone / Thread · reply sent (`mkptX`): new, instance of `Phone / Thread` with the reply shown.
- [ ] Phone / Thread · pull request (`S2bNY`): new, #1205's description, push, review request and sbrandt's comment.
- [ ] Phone / Thread · eighty events (`SL9Ha`): new. Description, two events, "Show 74 earlier events · 18 commits ·
  21 comments · 35 other events", dkim's review, "2 new since you looked", sbrandt's changes requested, mlaine's push
  of two commits.
- [ ] Phone / Thread · loading (`CBVcb`), · failed (`TZXjq`), · empty (`OAc3d`, #1209's description alone): new.
- [ ] Phone / Thread · editing (`NZWBY`), · editing, discard? (`ykeMB`), · sending (`Fqq9i`), · not sent (`xBpyV`),
  · linked (`uNjm3`): new, instances of `Phone / Thread`. Each replaces one card with the narrow state card.
- [ ] Phone / Thread · reviews (`CySKi`): new, #1205. Description, dkim's approval with its resolved thread folded,
  sbrandt's changes requested with the code thread on `src/series/migrate.ts`, mlaine's push.

Item panes (every screen using them follows):

- [ ] Phone / Item / Issue (`Z50g0`): `Body` (`V0Kas`) deleted, `Timeline` → `Phone / Thread` (`waUHW`).
- [ ] Phone / Item / Issue · summary (`qZhtg`): `Body` (`K3gLO`) deleted, `Timeline` → `Phone / Thread` (`ICvuM`).
- [ ] Phone / Item / Issue · every property (`D4CI1`): `Body` (`cZAFZ`) → `Phone / Thread` (`o0o33Z`).
- [ ] Phone / Item / Issue · further down (`UXIHb`): `Body` and `Timeline` deleted, layout none, `Phone / Thread`
  (`E039u`) scrolled 96 px.
- [ ] Phone / Item / Issue · reply sent (`aUYA5`): `Body`, `Timeline` and the extra comment deleted, layout none,
  `Phone / Thread · reply sent` (`rYB83`) scrolled 96 px.
- [ ] Phone / Item / Issue · arriving (`e1palS`): `Arriving` placeholder → `Phone / Thread · loading` (`o4sq4`).
- [ ] Phone / Item / Pull request (`PWGSV`): `Timeline` → `Phone / Thread · pull request` (`C9LWDp`).
- [ ] Phone / Item / Pull request · summary (`j4OTf`): `Body` (`edpHW`) deleted, `Timeline` → `Phone / Thread ·
  pull request` (`XHsMY`); MB98's pane (`Efidb`) overrides the description's text and age through it.
- [ ] Phone / Item / Pull request · stacked, a strip (`GSjJM`): `Body` (`wkAmz`) deleted, `Timeline` → `Phone /
  Thread · pull request` (`XVKTO`).
- [ ] Phone / Item / Pull request · long thread (`EkP8V`): the old section head, lines, gap, new-since line and
  comment deleted. The summary and `Phone / Thread · eighty events` (`dVt5j`) now sit in `Scrolled` (`hLill`), offset
  so the thread's end shows.
- [ ] Deleted, left unused: Phone / Item / Timeline (`KJnIN`), Phone / Comment (`Qidd9`), Phone / Timeline commit
  (`i4d4tt`), Phone / Timeline · new since you looked (`vpKWS`), Phone / Timeline gap (`G0HyHM`), Phone / Body
  placeholder (`OpGLL`).

New screens (`Screens · Acting on My work`, `pM9rS`, new row `Row · The thread`, `wjdFg`):

- [ ] MB226 · ⋯ on your comment: a menu at the bottom (`g17l5`).
- [ ] MB227 · Editing your comment in place (`wspHj`): keyboard up, the card above it.
- [ ] MB228 · Editing · Discard your changes? (`M6WDy`).
- [ ] MB229 · Your reply, sending (`n8tdw`).
- [ ] MB230 · Your reply, not sent (`pLbvn`): Discard and Retry.
- [ ] MB231 · A pull request's reviews in the thread (`zEtJB`).
- [ ] MB232 · A comment linked from the address (`dhXfc`): opened from a shared link, outlined.
- [ ] MB233 · The thread loading, the first time (`vgUMQ`), on #1201.
- [ ] MB234 · No comments yet (`OdPYY`), on the draft #1209.
- [ ] MB235 · The thread couldn't be loaded (`fUINC`), on #290.

Canvas:

- [ ] The nine top-level frames of the web and brand row (landing, docs, logo, icons, OpenGraph) moved 2057 px down.
  `App · Mobile` grew to 37161 px, and the row keeps 1200 px below it.

## Round 1b · summary variants, an agent brief run in parallel

Merged with round 1 by `bun nzyme pen merge`: 12 conflicts — the web and brand row's `y` (both rounds moved it; round 1's value kept, overlap fixed in round 2) and `Phone / Item / Timeline` (`KJnIN`), `Phone / Comment` (`Qidd9`), `Phone / Timeline commit` (`i4d4tt`), deleted by round 1 and still used by the variants (kept; repointed in round 2).

- [ ] Components · Mobile (`F3mZHt`): new section `In line with the desktop` (`e2bDp`) at the end, with
  `Summary parts · phone` (`MYTQO`) and `Summaries · phone` (`b0UBc`).
- [ ] Item / PR merge · phone (`T6Pdf7`): new, an instance of `Item / PR merge` (`BioKQ`) at 358 px. The key hints are
  hidden. Merge… and Review files get a ↗ in place of their keys (mobile D4, D11). The buttons' leading icons are
  hidden so the three buttons fit in 358 px. Data: 1 check failing, changes requested by sbrandt, the right-hand
  "1 approval" note hidden, the PR's branch and size.
- [ ] Item / Reviews · phone (`egNv9`): new, an instance of `Item / Reviews` (`JqSRM`), without ⇧R. Shows sbrandt
  (changes requested, 2h) and dkim (requested, 20m); the third reviewer is hidden.
- [ ] Item / Checks · phone (`KeFvH`): new, an instance of `Item / Checks` (`JKPLA`). One failing required check
  (`ci / e2e (chromium)`, its detail shortened to `6m 02s` so Log ↗ fits), 8 passed in one line; the other failing
  and running rows are hidden.
- [ ] Item / Properties · phone (`TK7Iu`): new, an instance of `Item / Properties` (`Ww7Se`), without the A, L, M keys.
- [ ] Item / Projects · phone (`FNp3Y`): new, an instance of `Item / Projects` (`UjUqQ`), without the S, P, I keys.
- [ ] Phone / Summary · pull request · as on the desktop (`WNkfa`): new. Standing card, Reviews, Checks, Closes
  (`Item / Linked` `MGnYu` as it is, its title shortened to fit), Properties (no bug label), Platform Q4's card.
- [ ] Phone / Summary · issue · as on the desktop (`YrWzg`): new. Properties with Sub-issues, then Platform Q4 and Bug
  triage as cards.
- [ ] Phone / Summary · pull request · hybrid (`yV0N7`): new. The standing card, Reviews and Checks, then the phone's
  `Phone / Property` rows for Assignees and Status, then `Phone / Property chips · pull request` (`ozxE4`) with
  its branch-and-size line hidden (the card shows them).
- [ ] App · Mobile (`jy6bO`): new section `In line with the desktop on a phone` (`GpTuZ`) after `mZPlf`. It has a
  header and the amber frame `Variants · The item's summary on a phone` (`vSNo8`).
- [ ] `MB260 · Variant A · A pull request that can't merge yet` (`l2kHV`), slot `LhUrW`: recommended, caption says why.
- [ ] `MB261 · Variant A · Where the summary ends` (`kSgXR`), slot `CUFCu`: the same pull request scrolled 536 px.
- [ ] `MB262 · Variant A · An issue with two projects` (`BBaIf`), slot `g77yYE`.
- [ ] `MB263 · Variant A · Ready to merge` (`RvliB`), slot `spk23`: the green card, Merge… primary.
- [ ] `MB264 · Variant B · A pull request that can't merge yet` (`B4hmjU`), slot `zb89T`.
- [ ] `MB265 · Variant B · Where the summary ends` (`on11A`), slot `VyoKi`: scrolled 430 px.
- [ ] `MB266 · Variant B · An issue with two projects` (`I77kBU`), slot `USt4O`: the phone's summary as in MB128.
- [ ] `MB267 · Variant B · Ready to merge` (`ta2np`), slot `eZbZr`.
- [ ] Landing — githq.dev (`JJOFX`), Landing — githq.dev (mobile) (`ucqck`), Landing — motion storyboard (`XCfAD`),
  Logo — git/hq (`S5J7kt`), App icons — generated (review) (`nCTdq`), OpenGraph images (`PiKGF`), Landing ·
  Download page (`jv9Tp`), Landing · Hero picture as built (`ykYxo`), Docs · githq.dev/docs — template (`I5wWZ`):
  moved down 3533 px (y 119232 → 122765), so the row stays 1200 px under `App · Mobile`.

Below each summary, the thread is the phone's today (`Phone / Item / Timeline` `KJnIN` with the item's body). Another
round replaces it.

Measured: in A the pull request's summary is 782 px tall, so its description starts more than a screen down. The issue's
is 384 px. In B the pull request's summary is 562 px.

## Round 2 · agent brief

Asked (`.context/mobile-writing-brief.md`): writing on a phone as the desktop's composer (D51), Settings · Privacy on a
phone, the phone's selected rows and highlighted command results in line with the desktop's selection, and the fixes
round 1 left: the web and brand row's overlap, the summary variants' old thread, the key hints on the editing card.

Changed: `Phone / Composer dock · typing` became the desktop's composer, with seven variants; three new phone menus and
a read-only command line; ten writing screens (MB236–MB245) in a new row; MB246 · Settings · Privacy; the selected
row's surface outlined; the summary variants on `Phone / Thread`; the old thread components deleted.

Decisions taken in this round:

- The composer is the desktop's editor turned upside down, so its tools sit just above the keyboard (D51): Close and
  Comment on top (the desktop's footer, right-aligned as there), the text, then Write, Preview and the folded tools
  (the desktop's head; the current tab hangs from the text area). Its buttons, tools and ⋯ are instances of the
  desktop's (`Button / medium · menu`, `Button / medium`, `Button / medium · primary`, `Activity / Editor tools ·
  folded`, `Activity / Editor · more tools, open`), keys hidden. The Write / Preview tabs and the text area are drawn in
  the component, as the desktop has no component for them.
- The text is 16 px, as in the phone's comment box before (iOS zooms a page on focus of a field under 16 px). The
  desktop editor's 13 px stays in the editing card of MB227/MB228, as round 1 left it.
- The tools' ⋯ menu is a `Phone / Menu` at the bottom with the keyboard down (D45). The @ and # menus are `Phone /
  Menu` with its keyboard part on, so they sit just above the keyboard; the composer's tools bar makes way while they
  are open. People are drawn with `circle-user`, as in `Phone / Menu / Assignees`.
- Close with comment's reason is the existing `Phone / Menu / Close` (`Fujkd`), titled "Close with comment" on MB241.
- Preview puts the keyboard down, so the preview variant shows the dock's home indicator.
- A locked item keeps ⌘ in the command line; the comment box is the desktop's `Activity / Composer · read-only` card.
- Selection: the selected selectable row has no fill of its own; its row's `Surface` takes `$sel` and the 1 px
  `#7B87F74D` outline, so the checkbox sits outside the surface, as the commit graph does on the desktop. No phone
  command result is highlighted anywhere (all 43 `Phone / Command result` instances checked), so nothing changed
  there. MB93's "back at the same row" highlight and its repository pane's were full-bleed `$sel`; they got the
  outlined surface too.
- No phone screen shows a key hint any more: the editing card of MB227 through a phone variant, and the Reply key in
  MB231's review card. MB228's card (`SSKJn`) already had none.
- MB73 is unchanged: leaving with text keeps the draft in the comment box at rest, and its draft starts as the
  composer's text does.

Components (`Components · Mobile`, `F3mZHt`, new section `Writing`, `O1nNc`, rows `Composer docks` `WSlci` and `Menus
and the locked line` `d9uBJ`):

- [ ] Phone / Composer dock · typing (`BGx6I`): moved into `Composer docks`. Was a pill with Send and a hidden ⌘ →
  the desktop's composer: `Actions` (`a5rL6`: Close `xFuJJ` = `Button / medium · menu` "Close with comment", Comment
  `skQ6F` = `Button / medium · primary`, keys hidden), `Text area` (`X9pGmy`, 16 px text `dQ6zQ`, a hidden `Rendered`
  preview `WHjem`), `Head` (`syXj3`: Write `u4YcNf`, Preview `H3wIpM`, the tools `lyqOI` with `Activity / Editor tools
  · folded` `t5hvVi`), a hidden home indicator (`JdImD`).
- [ ] Phone / Composer dock · empty (`YJ5LK`): new. Placeholder "Leave a comment", Close issue, Comment at 0.45.
- [ ] Phone / Composer dock · preview (`NCvab`): new. Preview current, the text rendered, the tools hidden, the home
  indicator shown.
- [ ] Phone / Composer dock · tools open (`s9Gv7y`): new. ⋯ as `Activity / Editor · more tools, open`.
- [ ] Phone / Composer dock · a menu above the keyboard (`pRXnP`): new. The head hidden, text ending "@s".
- [ ] Phone / Composer dock · closed issue (`UuizA`), · pull request (`tnhAD`), · merged (`wmgjy`): new, instances of
  `· empty`. Reopen issue (`Button / medium`, green `circle-dot`), Close pull request (red
  `git-pull-request-closed`), no close button.
- [ ] Phone / Menu / Editor tools (`cFbzw`): new, `Phone / Menu`: Bulleted list, Numbered list, Task list, Quote, then
  under "Insert" Mention someone and Reference an issue or pull request.
- [ ] Phone / Menu / Mention (`LkBKK`): new, `Phone / Menu` with the keyboard: People · @s, sbrandt (in this thread),
  sanders, sofiab.
- [ ] Phone / Menu / Reference (`d3Q0Y3`): new, `Phone / Menu` with the keyboard: #1205, #1209, #1201, #1190 with their
  state icons.
- [ ] Phone / Command line dock · read-only (`Xm35X`): new, instance of `Phone / Command line dock · item` with the
  comment box replaced by `Activity / Composer · read-only`, its rail hidden.
- [ ] Phone / Thread (`ShZ5Q`): new hidden events `Event · closed` (`gC1B0`, mlaine closed this as completed) and
  `Event · locked` (`iWOgf`, dkim locked this conversation).
- [ ] Phone / Thread · pull request (`S2bNY`): new hidden event `Event · merged` (`RHsSB`, mlaine merged into main).
- [ ] Phone / Thread · closed (`jpEl1`), · locked (`f3AG7G`), · merged (`Zg7Cj`): new, each shows its event and
  lengthens the rail to it.
- [ ] Activity / Comment · narrow, editing · phone (`w6BzvV`): new in `Cards and menu` (`eUtEh`), instance of `DFWqj`
  with the Esc and ⌘↵ keys hidden.
- [ ] Phone / Thread · editing (`NZWBY`): its editing card → `Activity / Comment · narrow, editing · phone` (`EXeku`),
  so MB227 shows no keys.
- [ ] Phone / Thread · reviews (`CySKi`): the Reply key in sbrandt's review card (`jd4oq` → `B8zor/i8NWhP`) hidden
  (MB231).
- [ ] Phone / Row / Selectable · selected (`h9ZxKZ`): row fill `$sel` → none; its row's `Surface` (`A70Zi/b73Ct`)
  `$sel` with a 1 px inside stroke `#7B87F74D`. MB117, MB118, MB119 and MB221 follow.
- [ ] Phone / List / Repository · back at the row (`U9tdw`): `Row #1171`'s surface (`AIER7` → `b73Ct`) gets the
  outline.
- [ ] Deleted: Phone / Item / Timeline (`KJnIN`), Phone / Comment (`Qidd9`), Phone / Timeline commit (`i4d4tt`).

Screens:

- [ ] MB71 (`fMjLV`), MB72 (`uVIfU`), MB91 (`fJdr7`): follow the new composer; the stale overrides on `h4Wh24`,
  `l8C6Od`, `Dv5Mx` removed (the long reply now on `dQ6zQ`); captions (`F6Tds`, `xZjT5`, `Byq6X`) rewritten for it.
- [ ] MB93 (`x97Y8`): the pane's (`U9Qttk`) full-bleed `$sel` on `Row webapp#1187` and `Nested #1205` → the outlined
  surface on the row alone.
- [ ] Row · Writing (`Cy2sA`): new row in `Screens · Acting on My work` (`pM9rS`), after `Row · The thread`:
  - MB236 · Writing on an issue, keyboard up (`omanm`)
  - MB237 · The tools' ⋯ open (`bDBys`)
  - MB238 · Preview (`Msq7u`)
  - MB239 · Typing @, the mention menu (`q8aO3l`)
  - MB240 · Typing #, the reference menu (`APJgi`)
  - MB241 · Close with comment, picking the reason (`PzweY`)
  - MB242 · A closed issue: Reopen issue (`jIf2d`)
  - MB243 · A pull request: Close pull request (`Wk8Ma`)
  - MB244 · A merged pull request: Comment only (`hHZWJ`)
  - MB245 · A locked issue: read only (`ciKTL`)
- [ ] MB246 · Settings · Privacy (`I75v0E`): new at the end of `Row · Settings · the other sections` (`H87JO`), built
  from MB158: group "Usage", the switch row "Share usage statistics" on, with T23's explanation, and a row "What githq
  counts" that leaves for the docs (↗).
- [ ] MB260–MB267's panes (`z1pT4`, `ruVlo`, `pGX4w`, `v2BuOd`, `HUY2w`, `l9DJYT`, `f6qKTF`, `S3TWfg`): the old `Body`
  frame deleted and `Timeline` → `Phone / Thread · pull request` (MB260, MB261, MB263, MB264, MB265, MB267) or `Phone /
  Thread` (MB262, MB266). The summaries themselves are unchanged.

Canvas:

- [ ] The web and brand row (`JJOFX`, `ucqck`, `XCfAD`, `S5J7kt`, `nCTdq`, `PiKGF`, `jv9Tp`, `ykYxo`, `I5wWZ`): y
  121289 → 126793, 1200 px under `App · Mobile`'s bottom (125593); x and order kept.

## Round 3 · agent brief

Asked (`.context/mobile-summary-apply-brief.md`): settle Variant A of the summary (D52), give every phone item the
desktop's summary in place of D25's rows and chips, redraw MB98 and MB125, delete MB128 and D25's components, and two
platform fixes from round 2: 16 px text in every phone field, and the formatting tools above the keyboard as 44 × 44
targets.

Changed: MB260–MB263 settled and Variant B deleted; ten state variants of the phone summaries; all ten `Phone / Item /
…` panes draw them, and every screen through them follows; MB98 shows its checks unfolded in the summary; MB125 is the
issue with every property, scrolled; MB128 deleted; D25's components deleted; `Phone / Editor tools` in the composer
and the editing cards.

Decisions taken in this round:

- A pull request's states are variants of `Phone / Summary · pull request · as on the desktop`, with the desktop's own
  standing-card texts (`App · Merging a pull request`, `App · Stacked pull requests`): waiting for review, changes
  requested, checks failing, conflicts, ready, draft, merged. The base stays MB260's "1 check failing · changes
  requested". Merge… keeps its ↗; Mark ready… on a draft has none, as a phone marks a draft ready (MB99); Resolve… on
  conflicts and Delete branch on a merged one keep it.
- Each screen keeps its pull request: #1205 waiting for review (MB33, MB60, MB110, MB122, MB126, MB220), #1205 with
  changes requested (MB97), #1201 with e2e (chromium) failing and dkim's approval (MB98, MB233), the draft #1209
  (MB99, MB234). #1201 and #1209 had inherited #1205's branch, size, Closes #1187 and calendar label through
  overrides; they now have their own (`chore/payment-sdk-12` +46 −31, 7 files, payments; `series-timezone-label` +38
  −6, 3 files) and close nothing.
- #290 (MB95, MB235) shows the desktop's empty values: Assignees "No one", Milestone "None", and its Platform Q4 card
  Todo with Priority, Iteration and Estimate "Empty" (`ItemProperties`, `ItemProjects` in the app).
- The issue summary has a hidden `Closed by` block (#1205, waiting for review), as the desktop's issue summary has.
  MB125's "every property" variant shows it; MB262 and the other issue screens are unchanged.
- Screens whose story is the thread (MB233, MB234) or the checks (MB98) are scrolled the way MB261 is: a `Pane` frame
  with a `Scrolled` frame of the head, summary and thread instances, since the longer summary pushed their thread below
  the fold.
- MB110's reviewer menu read sbrandt's latest verdict as "changes requested" while #1205 waits for review; it reads
  "commented", as the thread has it.
- The tools above the keyboard are bold, italic, code and link, each a 44 × 44 `Phone / Editor tool`, then ⋯ (5 × 44
  fits beside Write and Preview in 390 px). Heading goes behind ⋯, at the top of `Phone / Menu / Editor tools`. The
  editing cards (MB227, MB228) are 312 px wide, so they keep bold and italic, then ⋯.
- The new issue form (MB194–MB196) still draws D25's rows and chips: it is not an item summary, and redrawing it after
  the desktop's form is a separate decision. Its captions say so; its titles drop "The item's".

Settling the pick (`In line with the desktop on a phone`, `GpTuZ`):

- [ ] Row · Variant B · Hybrid (`g75QcV`) with MB264–MB267 (`B4hmjU`, `on11A`, `I77kBU`, `ta2np`): deleted.
- [ ] Row · Variant A · As on the desktop (`bpIOu`): moved out of the Variants frame into `GpTuZ`, renamed `Row · The
  desktop's summary`.
- [ ] Variants · The item's summary on a phone (`vSNo8`): deleted.
- [ ] MB260 (`LhUrW`, `l2kHV`, `sFElk`), MB261 (`CUFCu`, `kSgXR`, `ghCn7`), MB262 (`g77yYE`, `BBaIf`, `JCvED`), MB263
  (`spk23`, `RvliB`, `S3Ivs`): `Variant A · ` dropped from slot, screen and caption names; notes (`ovXji`, `j6bgZG`,
  `z4xGc`, `PqUdr`) rewritten to describe the screen.
- [ ] Header description (`XI1fv`): rewritten for the settled summary.
- [ ] MB263's summary (`ekKZV`, 21 overrides on the base) → `Phone / Summary · pull request · ready` (`s51yWH`), no
  overrides.

Components (`Components · Mobile` → `In line with the desktop`, `e2bDp`):

- [ ] Title (`HXxwW`): names the states instead of the two variants.
- [ ] Item / Check · passed, nested (`jA2Lv`): new in `Summary parts · phone`, the desktop's unfolded passed check
  (`CheckList.vue`): icon, name, "passed in …", Log ↗, 29 px in.
- [ ] Item / Checks · phone, passed unfolded (`nJ9Rk`): new. `Item / Checks · phone` with #1201's checks and the
  chevron down, then eight nested rows (e2e (webkit), unit, lint, typecheck, build, Cloudflare Pages, CodeQL,
  license / policy).
- [ ] Phone / Summary · issue · as on the desktop (`YrWzg`): new hidden first block `Closed by` (`V9gH1h`, `Item /
  Linked`: #1205, waiting for review).
- [ ] Phone / Summary · issue · every property (`L0fAQ`), · unassigned, one project (`vWAbl`): new in `Summaries ·
  phone` (`b0UBc`).
- [ ] Pull request summaries by state · phone (`T78Ak`): new row in `e2bDp`, holding `Phone / Summary · pull request ·`
  waiting for review (`FUWE9`), changes requested (`nkkJy`), checks failing (`AB1Wt`), conflicts (`q5Pag`), ready
  (`lCo9U`), draft (`OA04b`), merged (`xySZQ`), and checks failing, passed unfolded (`SNC2N`, an instance of `AB1Wt`
  with its Checks block swapped for `nJ9Rk`).
- [ ] Phone / Summary · pull request · hybrid (`yV0N7`): deleted with Variant B.

Item panes (every screen using them follows):

- [ ] Phone / Item / Issue (`Z50g0`): Properties (`P7E2C`) → Summary `YrWzg` (`JSGY3`).
- [ ] Phone / Item / Issue · summary (`qZhtg`): Properties (`N4tkj`) → Summary `YrWzg` (`BKc8Y`).
- [ ] Phone / Item / Issue · arriving (`e1palS`): Properties (`Y39abV`) → Summary `vWAbl` (`zqNGB`).
- [ ] Phone / Item / Issue · every property (`D4CI1`): Properties (`Z5P6y`) → Summary `L0fAQ` (`s2ybkM`); layout
  none, the head, summary and thread moved into `Scrolled` (`hH5Bn`) at y −135.
- [ ] Phone / Item / Pull request (`PWGSV`): Where it stands (`w0l8bC`), Properties (`u2twM5`) and the `On GitHub` row
  (`zN7xb`) → Summary `FUWE9` (`bjoiN`).
- [ ] Phone / Item / Pull request · summary (`j4OTf`): Where it stands (`Qifsd`), Properties (`M5WUcK`) → Summary
  `FUWE9` (`h1HFvp`).
- [ ] Phone / Item / Pull request · stacked, a strip (`GSjJM`): Where it stands (`ayltP`), Properties (`gBAmb`) →
  Summary `FUWE9` (`rzjbl`) under the strip.
- [ ] Phone / Item / Pull request · long thread (`EkP8V`): Where it stands (`b6cRD`), Properties (`q9nAzO`) → Summary
  `nkkJy` (`jJXPX`); `Scrolled` (`hLill`) y −533 → −1029 so the thread's end stays in view.
- [ ] Phone / Item / Issue · further down (`UXIHb`), · reply sent (`aUYA5`): unchanged, they show only the thread.

Screens:

- [ ] MB99 (`h4L9nQ`): its pane's (`y0oJ22`) summary → `OA04b` (`mXWQO`).
- [ ] MB234 (`JPEcV`): pane `a2fwn3` → frame `Pane` (`h24rh`) with `Scrolled` (`X29LeN`, y −420): #1209's head, `OA04b`,
  `Phone / Thread · empty`.
- [ ] MB233 (`YwFN7`): pane `H5pUxC` → frame `Pane` (`Yw3Ny`) with `Scrolled` (`lrpd9`, y −470): #1201's head,
  `AB1Wt`, `Phone / Thread · loading`.
- [ ] MB98 (`jcNAD`): pane `Efidb` → frame `Pane` (`JshP2`) with `Scrolled` (`G1K0H`, y −300): #1201's head, `SNC2N`,
  #1201's thread; the scrim (`wHuo7`) and the sheet's holder (`tld0a`) deleted. Caption (`nCQMK`) rewritten.
- [ ] MB125 (`ZD5YG`): follows `D4CI1`; caption (`soGyJ`) rewritten.
- [ ] MB128 · Rows, then chips (`Cx98x`, screen `x5PLpW`): deleted. Its code is not reused.
- [ ] MB110 (`UlxQo`): sbrandt's verdict in the reviewer menu (`l7tTt/lV2f9/s255dF`) "changes requested" →
  "commented"; caption (`Sgxsl`) names Request at the head of Reviews.
- [ ] Captions rewritten for the summary: MB40 (`SEWnG`), MB60 (`kA1Ux`), MB94 (`bUUCb`), MB99 (`JsH6J`), MB108
  (`mTZ17`), MB126 (`rqs3g`).
- [ ] MB194 (`H1y1T`, `Prb2P`, `qeB56`), MB195 (`kaOWp`, `h12PVi`, `relhT`), MB196 (`hqCS9`, `SE9dq`, `GeR5v`): "The
  item's rows and chips" → "The form's rows and chips"; notes `pwD8s` and `v6CkJ` no longer say the form reads like the
  item.
- [ ] MB33, MB35, MB38, MB40, MB41, MB52, MB60, MB62, MB70, MB73, MB74, MB82, MB94, MB95, MB108, MB109, MB112, MB122,
  MB126, MB220, MB235: follow their item pane, no change of their own.

Deleted, left unused: Phone / Properties · issue (`Mg3Qu`), · pull request (`ZgPo0`), · issue, every property
(`k9uHBB`), Phone / Property chips · issue (`EywvE`), · pull request (`ozxE4`), Phone / Property · more (`gKSlh`), ·
fewer (`DYbxw`), Phone / Where it stands (`Pv3sV`) with · waiting for review (`Rir6O`), · ready (`BSocv`), · conflicts
(`QVCVx`), · changes requested (`G2sL42`), · checks failing (`AfKnp`), Phone / Sheet / Checks (`MZluT`), Phone / Check
row (`N1d0ew`).

- [ ] Kept, still used by the new issue form: Phone / Chip (`oEda7`), Phone / Property (`VILkz`), Phone / Property ·
  assignees, assign to me (`W7sKw0`).

Platform fixes (`Components · Mobile` → `Writing`, `O1nNc`):

- [ ] Phone / Editor tool (`Ysz3O`): new in `Composer docks` (`WSlci`), a 44 × 44 target with an 18 px icon in
  `$fg-2`. Phone / Editor tool · open (`Nzg7Y`): new, its instance with `$bg-3` and the icon in `$fg`.
- [ ] Phone / Editor tools (`hcgsH`): new. Bold, Italic, Code, Link, More tools (⋯).
- [ ] Phone / Composer dock · typing (`BGx6I`): `Activity / Editor tools · folded` (`t5hvVi`) → `Phone / Editor tools`
  (`PUCUW`); Head (`syXj3`) padding [0,6,6,8] → [0,6,0,8], Tools (`lyqOI`) padding [0,6] → 0. Every composer variant
  follows.
- [ ] Phone / Composer dock · tools open (`s9Gv7y`): its ⋯ override (`t5hvVi/DLIm0` → `KYOL3`) → `PUCUW/HbK87` →
  `Phone / Editor tool · open`.
- [ ] Phone / Menu / Editor tools (`cFbzw`): Heading first; the rest move down one slot, "Insert" heads Mention someone
  (slot 6, `NNPB0`), Reference is slot 7 (`JPkVG`).
- [ ] MB237 (`wDKN7`): the pane (`pm4ci`) 179 → 131 px tall and its thread (`rBRWj`) y −315 → −363, for the taller
  menu.
- [ ] Activity / Comment · narrow, editing · phone (`w6BzvV`): text (`pehHx/mnTU1`) 13 → 16 px; the tools (`pehHx/UP6a5`)
  → `Phone / Editor tools` with Code and Link hidden.
- [ ] Activity / Comment · narrow, editing, discard? (`SSKJn`): the same (`xJp53` → `rx8oL`, `pehHx/mnTU1` 16 px).
- [ ] MB227 (`aEhjZ`) y −51 → −66, MB228 (`ti4Gd`) y −50 → −65: the taller card stays above the keyboard.
- [ ] Phone / Menu (`gf3JG`): search text (`qig8z`) 15 → 16 px; every phone menu with search follows.
- [ ] Captions for the tools and the 16 px text: MB71 (`F6Tds`), MB227 (`dRKVg`), MB236 (`LkFLu`), MB237 (`YdTpK`).

Canvas:

- [ ] The web and brand row (`JJOFX`, `ucqck`, `XCfAD`, `S5J7kt`, `nCTdq`, `PiKGF`, `jv9Tp`, `ykYxo`, `I5wWZ`): y
  126793 → 124906, 1200 px under `App · Mobile`'s bottom (123706); x and order kept.
