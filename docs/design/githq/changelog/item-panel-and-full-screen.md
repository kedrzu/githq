# Items in the panel and full screen, two columns when wide

The item modal goes. An issue or pull request opens in the panel beside the list; ↵ on the open row (or the header's
button) expands it to full screen, Esc brings it back. The item view picks its layout by its own width (a container
query): from 1000 px it splits into a pinned summary column (440 px) and a scrolling timeline capped at 920 px (was
760); below that it is one column, the summary above the thread, as the panel is today. Base: `69b26059`.

## Round 1 · agent brief

Asked (`.context/item-layout-brief.md`): the two-column full screen at 1440 and 1920, the panel dragged wide, the
panel at 560, full screen on a small window, an issue in two columns; the 3-segment arrangement switch becomes one
button; the modal screens and the modal's option removed.

Decided in the round:

- **Summary column 440 px** (the brief's upper bound), 20 px padding, `$bg` with a 1 px `$border` on its right
  against the timeline's `$bg-item`. 440 is the narrowest that holds the merge standing and the check rows on one line,
  and only once the merge buttons drop their key hints and the reviews condition drops its right-hand note. At 400 the
  three merge buttons overflow even without hints.
- **Breakpoint 1000 px** of item view width: 440 summary + 560 of timeline, the panel's default width. So the
  default panel and a 900 px window stay one column, a full screen at 1280+ and a panel dragged past 1000 split.
- **Timeline aligned to the summary**, 40 px from it, not centred: it doesn't drift as the window widens, and the
  leftover past the 920 px cap stays empty on the right (284 px at 1920 with the sidebar expanded).
- **The full screen's button is "Back to the panel"** (`minimize-2`, key Esc), the panel's is "Open full screen"
  (`maximize-2`, key ↵). On a window too narrow for the panel the button is hidden (F22, a question).

Components:

- [x] Item / Toolbar (`I6JTP`): the `Presentation` switch (`W2qyow`: Mode panel `CR0Uo`, Mode modal `q7usRO`, Mode
  full `p0sQi`) is deleted; in its place `Arrangement` (`gDNX8`), an instance of the new button below. Every item
  header in the file picks it up (41 instances).
- [x] New `Item / Arrangement · open full screen` (`NQMZE`), in Components · Item sections: radius 6, padding 3 4 3 6,
  gap 6; `maximize-2` 14 `$fg-2`, a `Kbd / icon` ↵ (`corner-down-left`), a hidden `Kbd` "Esc".
- [x] New `Item / Arrangement · back to the panel` (`rvl6R`): its variant, `minimize-2`, ↵ hidden, Esc shown.
- [x] New `Item / Toolbar · full screen` (`ZzpBW`): a variant of `Item / Toolbar` with the arrangement button
  showing "back to the panel".
- [x] New `Stack / Map` (`NtM5a`) in Components · Stacks: the stack map SP35 drew by hand (head, a row per pull
  request, what stops the stack), made a component so the summary column can hold it.
- [x] New `Item / Summary · pull request` (`NjMaL`): vertical, 440 wide, padding 20 20 24 20, gap 20, `$bg`, right
  border `$border`, clip. Children: `Stack map` (`m5QwD`, hidden unless stacked), Title, PR merge, Reviews, Checks,
  Linked ("Closes"), Properties, Projects (instances of the item sections, overrides as in `Item view / PR panel`).
  In it the merge block hides its three buttons' key hints (`iICyO` ⇧M, `gynBw` O, `JjFn3` D) and the reviews
  condition's "1 approval · dkim" (`CowyG`); the passed checks' names read "lint, typecheck, build and 3 more".
- [x] New `Item / Summary · issue` (`RtacV`): its variant with the merge, reviews, checks and linked sections hidden,
  and I1's issue title, properties and projects.

Screens swapped to the full-screen header (`Item / Toolbar` → `Item / Toolbar · full screen`, overrides kept):

- [x] F2 (`vUcHq` → `vKQmD`), F4 (`u6dnEQ` → `xSohj`), F5 (`YkzFi` → `M3ohx`), F10 (`f0TUNz` → `Nro43`).
- [x] SP35 (`kEW8i` → `RTEN3`), SP36 (`TN7lE` → `xLwkF`), CR1 (`KrcbH` → `G4MMo6`), I1 (`sLPGT` → `f8Wlul`).
- [x] Item view / split (`a80hmX`): its toolbar `c5JqCZ` → `Eph28`, so D3, H6, T12 and T15 (full pages) show
  "back to the panel".
- [x] M2 (`LDcGG`), the hand-drawn header with the item menu trigger (`ihcgM`): its switch `UBtkE` → `z7jx8b`, an
  instance of `Item / Arrangement · back to the panel`.
- [x] SP5 (`mAAFx`), the hand-drawn panel header (`YPRJ7`): its switch `jgWxz` → `uyvi3`, an instance of
  `Item / Arrangement · open full screen`.
- [x] SP35 (`i3LZ1T`): its hand-drawn `Stack map` (`JnxKj`) → an instance of `Stack / Map` (`MlkRn`), same tree.

New screens in App · Pull request (`XN8vf`), three new rows (`Q2AMop`, `z5ZFg`, `zgEPY`):

- [x] `F18 · PR full screen · two columns, the thread scrolled` (slot `F9QSe`, screen `lsBpS`): 1440 × 900, sidebar
  expanded, full-screen header, `Item / Summary · pull request` on the left, the timeline (F5's description and
  thread) on the right, 684 px, scrolled past the description with a review cut by the header.
- [x] `F19 · PR full screen · a wide window, stacked` (slot `S21fYP`, screen `P1Y0d`): 1920 × 1080; the timeline at
  its 920 px cap, 284 px empty on the right; the stack map shown at the top of the summary (#1186, #1187 current,
  "#1187 can't merge yet: 2 checks failing"); scrolled to the end, the composer in view.
- [x] `F20 · PR in a panel dragged wide · two columns` (slot `qi46s`, screen `uAkdB`): 1728 × 1080, sidebar on its
  rail, My work at 572 px, the panel at 1100 px with the panel's header and the same two columns (timeline 660, 580
  of thread), not scrolled.
- [x] `F21 · PR in the panel at 560 px · one column` (slot `mvYZE`, screen `R5O1zL`): F1's screen as it is now, one
  column, with "Open full screen" in the header.
- [x] `F22 · Question · PR full screen on a small window · one column` (slot `E4rAB5`, amber, screen `ktjje`):
  900 × 1180, the rail and `Item view / PR panel` at full width, one column; its arrangement button hidden. The
  question: hide it, or keep it disabled with a tooltip.
- [x] `F23 · Issue full screen · two columns` (slot `xdBrQ`, screen `zesTQ`): 1440 × 900, `Item / Summary · issue`
  with a two-line title, I1's description and thread, not scrolled.

Removed (codes stay retired):

- [x] App · My work: `D2 · Sidebar collapsed · List · Item in modal` (`iWJgr`).
- [x] App · Issue: `Slot · I3 · Issue in modal · not planned and locked` (`NVC4S`). The not-planned, locked,
  read-only composer state has no screen of its own now; its parts (`Activity / Composer · read-only`, `fBQzF`) stay.
- [x] App · Stacked pull requests: `Slot · SP33 · In a modal, stack of two` (`juKQy`), `Slot · SP34 · In a modal,
  stack of ten` (`p7LZ5W`), and their row (`ZUP0e`).
- [x] App · Project, D4's Display popover (`Cpz18`): the "Open items in" section (`v1aU3`: Panel, Modal, Full page,
  "Links to an item always open the full page."): the arrangement is no longer remembered.

Text:

- [x] E1 command menu (`XfNMb`) and L1 context menu (`nUeuZ`): "Open as full page" → "Open full screen" (the ⇧F
  key next to them is unchanged).
- [x] Overview (`hbsg2`): point 3 describes the panel and full screen, the 1000 px split and how ↵ / Esc move between
  them (was panel, modal or full page, a 760 px split and ⇧F).
- [x] Captions without the modal: SP walk (`w3Oqo`), SP stack map (`vlL0h`), the issue thread (`r73zdO`), CR's
  "Review files" (`yWWEN`).

Left for a later round:

- The older full-page screens (F2, F4, F5, F10, SP35, SP36, CR1, I1, and D3, H6, T12, T15 through
  `Item view / split`) still show the old page layout (a 760 px main column and a 340 px side column; SP35/36 with a
  stack column on the left). Only their header changed. F18–F23 are the new layout.
- Whether ⇧F stays as the menus' key for "Open full screen" next to ↵.
- `docs/design/githq/DECISIONS.md` D9 still describes three arrangements.

## Round 2 · agent brief

Asked (`.context/item-layout-brief-2.md`): bring the file in line with the shipped app. `⇧↵` toggles the panel and
full screen both ways, `↵` on the open row expands, `Esc` steps back from a page expanded from the panel; F22's question
is settled (the button is hidden); the older full-page screens move to the two-column layout of F18/F23.

Decided in the round:

- **The key is drawn as one `Kbd / two icons` (`guh3O`)**, arrow-big-up and corner-down-left, as `⌘↵` is drawn
  everywhere. In the menus it is two keys, `⇧` and `↵`, as the rows next to it draw theirs.
- **The moved screens keep their data.** Each screen's sections were compared with the summary's, node by node, and
  only what differs is overridden on its `Item / Summary` instance. The summary's narrow-width rules win over the old
  wide screens: the merge buttons' key hints and the reviews condition's note stay hidden, and the passed checks keep
  the summary's short names unless the screen had its own.
- **F5 and F10 show the merge standing, checks and "Closes"** in their summary: the old page hid them because it was
  drawn scrolled past them; the summary is pinned, so they stay in view.
- **M2 moves too**, though the brief didn't list it: it was the one other screen still on the old page.

Components:

- [x] Item / Arrangement · open full screen (`NQMZE`): `Kbd ↵` (`wAiRI`) and the hidden `Kbd Esc` (`uDprN`) →
  one `Kbd ⇧↵` (`u7bSx`, an instance of `Kbd / two icons`).
- [x] Item / Arrangement · back to the panel (`rvl6R`): its overrides on `wAiRI` / `uDprN` dropped; it now differs
  from the open variant only by its icon (`minimize-2`), the key is `⇧↵` in both.
- [x] Item view / split (`a80hmX`): 1100 × 820 → 1384 × 874; its `Main column` (`i6lUj`) and `Side column`
  (`U8pGeB`) → `Summary` (`Sy4fr`, an instance of `Item / Summary · issue` with this issue's title, "Closed by #1205"
  shown, its properties and two projects) and `Timeline column` (`JWG5a`, padding 0 40 24 40, clip) with `Timeline`
  (`R2Ran`, gap 22, top 28) holding the old `Thread` (`hiMJo`). D3, H6, T12 and T15 follow.
- [x] D3, H6, T12, T15: their `Item view (full page)` instances (`K9iRG` → `PzChA`, `GqenN` → `xNgs6`, `yhL9Q` →
  `cnXTI`, `KOQqC` → `YmJi4`) replaced by plain instances: the overrides of the old columns' padding and width and the
  `$bg` fill are gone, so the view shows `$bg-item` beside the summary's `$bg`, as F23.

Screens moved to the two columns (the old `Main column` and `Side column`, and `Stack column` where there was one,
deleted; `Item / Summary · pull request` (`NjMaL`) on the left, 440 px; a `Timeline column` with a `Timeline` taking
the old main column's description, thread and composer on the right):

- [x] F2 (`dfRzu`, Columns `p7x0a9`): `Summary` `jQy8P`, timeline `Zgj09` / `EcyWR`. Same data as the summary.
- [x] F4 (`TM0pz`, `BG6vb`): `Summary` `Y2FX64` (ready to merge, 9 passed, approved), timeline `J5zciW` / `U5rGe`.
  "Closes" status "In progress +1" → "In progress", which clipped at 440 px.
- [x] F5 (`yQg27`, `i5s9oI`): `Summary` `npiKf`, timeline `L5I4A` / `HeLo8`; screen height 1959 → 1887 (the title
  left the timeline).
- [x] F10 (`NvOUb`, `cq7fQ`): `Summary` `gTaA2`, timeline `X3oK8w` / `N9UGbe`; height 2303 → 2231.
- [x] SP35 (`i3LZ1T`, `KCS4N`): `Summary` `Q1Jr5`, its `Stack map` (`m5QwD`) shown with the defaults of
  `Stack / Map`, as the deleted column's `MlkRn` was; timeline `c9sN1` / `ueBlu`.
- [x] SP36 (`TqeoR`, `k49J6F`): `Summary` `jsxHh`, its `Stack map` replaced by the column's hand-drawn map of ten
  (`Zv2QX` → `gfkCO`, full width, the map's bottom line); timeline `lD5nk` / `h69xr`.
- [x] CR1 (`a4xAn`, `Tso7G`): `Summary` `IvW6s`, its `Stack map` an instance of `Stack / Map` overridden to the
  hand-drawn `rSNAl` it replaces ("Offline sync for workouts", 2 of 4, #1201, #1202); timeline `uUHvf` / `JUy0c`.
- [x] I1 (`r4Iwpc`, `OOvfn`): `Item / Summary · issue` `xP2qz`, timeline `L5f2J` / `C0H78`; height 1378 → 1303.
- [x] M2 (`LDcGG`, `B9Qo2`): `Summary` `Oz7TI`, timeline `zp3jO` / `a9nBYc`; the item menu over it unchanged.

Keys and text:

- [x] E1 command menu, `Result Open full screen` (`f5IQh6`, was "Open as full page"): `Kbd F` (`mEupH`) → `Kbd ↵`
  (`wPcgs`), so ⇧F → ⇧↵.
- [x] L1 context menu, `Item Open full screen` (`Ev5gr`, was "Open as full page"): `Kbd F` (`XITWu`) → `Kbd ↵`
  (`qVQqr`).
- [x] Overview (`hbsg2`): "↵ again (or the header's button) takes it full screen and Esc brings it back" → ⇧↵ (or the
  button) both ways, ↵ on the open row expands too, Esc steps back from a page expanded from the panel; a narrow window
  opens it full screen without the button.
- [x] F18 caption (`NyyOn`), F20 (`r2WqoI`): ↵ → ⇧↵ as the way to and from full screen.
- [x] F21 caption (`tE8Mg`): the button's key ↵ → ⇧↵; "⇧↵ on a row goes straight to the full screen" (not what was
  built: ⇧↵ is never the list's key) → "⇧↵ works wherever an item is open; ↵ on the open row does the same".
- [x] F22: `Question ·` dropped from the slot (`E4rAB5`), its caption title (`D7Jq7`) and the screen (`ktjje`); the
  slot's amber fill, stroke and padding removed, a plain slot like F21's; caption (`kYldH`): the button is hidden there
  and ⇧↵ does nothing, Esc closes to the list.
- [x] F2 caption (`Ha8CW`): describes the two columns, and says its old point (checks at the main column's width,
  reviewers atop a side column) belonged to the old page.
- [x] F5 caption (`s4L7N6`): "Scrolled down: the merge box and checks … hidden here" → drawn whole, the pinned summary
  keeps the standing, reviews and checks in view.
- [x] SP35: slot (`M0m98D`), caption title (`MMHC3`) and screen (`i3LZ1T`) "On a full page, stack of two: its own
  column on the left" → "Full screen, stack of two: the map tops the summary"; caption (`STaMo`) says the full-height
  column, and its point of not shifting the content, are gone.
- [x] SP36: slot (`ipzhn`) and caption title (`wpZhU`) → "Full screen, stack of ten: the map tops the summary"; the
  screen (`TqeoR`) "SP37b · Full page · Map column on the left" → "SP37b · Full screen · Map at the top of the summary"
  (its old code kept); caption (`x93Pa0`): the map pushes the rest down, the summary scrolls on its own, the 300 px
  column is gone.
- [x] SP group note (`vlL0h`): "on a full page the rows have a column of their own" → "full screen, the map tops the
  summary column".

Still open:

- `docs/design/githq/DECISIONS.md` D9 still describes three arrangements.
- SP36's screen is coded `SP37b` inside the `SP36` slot, as before this round.

## Round 3 · implementation

Built in PR #265 from rounds 1 and 2: every entry above is ticked. D9 in `docs/design/githq/DECISIONS.md` describes the
panel and full screen, the room rule and the two columns. In the code the merge block hides its key hints and the
conditions' note below 480 px of its own width (the summary's 400 px of content), and the context menu's command reads
"Open full screen", as E1 and L1 draw it. No change to the file.

## Round 4 · agent brief

Asked (`.context/item-layout-brief-3.md`): on the two-column screens the item header's bottom line and the summary
column's divider don't match each other or the other panel borders; make each one 1 px `$border` line, as the panel's
left border (F21) and the review's file list divider (CR). The summary column is resizable, as the review's file list.

Found: the colours were right (`$border` everywhere, no opacity, no `$border-2`). Every stroke in the file is centred
on its frame's edge, so the header's bottom line ran 47.5–48.5 px and the summary's `$bg` fill, starting at 48, painted
over its lower half: over the summary, and over any card the header cuts in the timeline, it showed as half a line
blended into `$bg`, while over the timeline's empty padding it showed whole. The panel's left border and the review's
divider look right only because nothing paints over them. Drawn inside, the lines sit within their own frames, as the
app's CSS borders do, and nothing can cover them.

- [ ] Item / Toolbar (`I6JTP`): stroke alignment centre → inner; its bottom line is now the header's last pixel row
  (47–48), one full 1 px line over both columns. `Item / Toolbar · full screen` (`ZzpBW`), `Item view / split`
  (`a80hmX`) and every item header follow.
- [ ] Item / Summary · pull request (`NjMaL`): stroke alignment centre → inner; its right line is the column's last
  pixel column (439–440). `Item / Summary · issue` (`RtacV`) and every summary follow. Checked at 4× where the lines
  meet: F18 (`lsBpS`), F2 (`dfRzu`), F20 (`uAkdB`, and its corner with the panel's left border), F23 (`zesTQ`), SP35
  (`i3LZ1T`), D3 (`SUsSL`).
- [ ] F18 caption (`NyyOn`): the summary is "440 px by default" with "a 1 px $border on its right", and its right edge
  is dragged as the review's file list, 360–560 px, kept on this device, the handle shown only on hover.

## Round 5 · agent brief

Asked by the owner (`.context/item-seamless-columns-brief.md`): two columns came too early in the panel, and they looked
like the app's other column screens. Now the panel splits from 1300 px of its own width (a page still from 1000 px), and
the two columns are one `$bg-item` surface with no line between them. The edge is still dragged, drawn in `$accent`
only while hovered, and both columns' content sits 32 px from it, so it lies midway. Built in the same PR: every entry
is ticked. This supersedes round 4's right line on the summary (the line is gone), not its header line.

- [x] Item / Summary · pull request (`NjMaL`): fill `$bg` → none; right stroke `$border` → none; padding
  `[20,20,24,20]` → 32. `Item / Summary · issue` (`RtacV`) follows.
- [x] `NjMaL` check names, text only (376 px of content, as `CheckList` ellipsises them): "ci / test (node 20)" →
  "ci / test (nod…", "ci / e2e (chromium)" → "ci / e2e (chro…".
- [x] Item view / split (`a80hmX`): timeline column `JWG5a` padding `[0,40,24,40]` → 32, its timeline `R2Ran`
  `[28,0,0,0]` → 0; D3 (`SUsSL`), H6 (`U5eptM`), T12 (`B2JQS`), T15 (`IUXq5`) follow.
- [x] Timeline columns `[0,40,24,40]` → 32 and their timelines `[28,0,0,0]` → 0: F2 (`Zgj09`/`EcyWR`), F4
  (`J5zciW`/`U5rGe`), F5 (`L5I4A`/`HeLo8`), F10 (`X3oK8w`/`N9UGbe`), F20 (`KQb49`/`abZLC`), F23 (`D6DCCM`/`mw6nf`), M2
  (`zp3jO`/`a9nBYc`), SP35 (`c9sN1`/`ueBlu`), SP37b (`lD5nk`/`h69xr`), CR1 (`uUHvf`/`JUy0c`), I1 (`L5f2J`/`C0H78`).
- [x] Scrolled timelines, the scroll kept: F18 `ENPlN` `[-605,40,24,40]` → `[-577,32,32,32]`, `H5vD8C` → 0; F19
  `GXvmg` `[-826,40,24,40]` → `[-798,32,32,32]`, `rK9we` → 0.
- [x] F20 (`uAkdB`): screen 1728 → 1920 wide, `PR view (panel)` (`CKFxj`) 1100 → 1300, caption (`NkK8g`) 1728 → 1920;
  the row `z5ZFg` grows to 3440 px inside `App · Pull request`.
- [x] F4 (`Y2FX64`), text only: "Stripe webhooks dropped during deploys" → "Stripe webhooks dropped during…", "Approved
  · checks passed · no conflicts" → "Approved · checks passed · no confl…".
- [x] Captions: F18 (`NyyOn`) one surface, the edge unseen until hovered, 32 px either side, 1000 px on a page and 1300
  px in the panel; F19 (`JyZIA`) 40 → 32 px from the edge; F20 (`r2WqoI`) the 1300 px panel; the overview
  (`hbsg2`, `App · Overview — Direction D`) "from 1000 px" → "from 1000 px on a page (1300 px in the panel)".
