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

- [ ] Item / Toolbar (`I6JTP`): the `Presentation` switch (`W2qyow`: Mode panel `CR0Uo`, Mode modal `q7usRO`, Mode
  full `p0sQi`) is deleted; in its place `Arrangement` (`gDNX8`), an instance of the new button below. Every item
  header in the file picks it up (41 instances).
- [ ] New `Item / Arrangement · open full screen` (`NQMZE`), in Components · Item sections: radius 6, padding 3 4 3 6,
  gap 6; `maximize-2` 14 `$fg-2`, a `Kbd / icon` ↵ (`corner-down-left`), a hidden `Kbd` "Esc".
- [ ] New `Item / Arrangement · back to the panel` (`rvl6R`): its variant, `minimize-2`, ↵ hidden, Esc shown.
- [ ] New `Item / Toolbar · full screen` (`ZzpBW`): a variant of `Item / Toolbar` with the arrangement button
  showing "back to the panel".
- [ ] New `Stack / Map` (`NtM5a`) in Components · Stacks: the stack map SP35 drew by hand (head, a row per pull
  request, what stops the stack), made a component so the summary column can hold it.
- [ ] New `Item / Summary · pull request` (`NjMaL`): vertical, 440 wide, padding 20 20 24 20, gap 20, `$bg`, right
  border `$border`, clip. Children: `Stack map` (`m5QwD`, hidden unless stacked), Title, PR merge, Reviews, Checks,
  Linked ("Closes"), Properties, Projects (instances of the item sections, overrides as in `Item view / PR panel`).
  In it the merge block hides its three buttons' key hints (`iICyO` ⇧M, `gynBw` O, `JjFn3` D) and the reviews
  condition's "1 approval · dkim" (`CowyG`); the passed checks' names read "lint, typecheck, build and 3 more".
- [ ] New `Item / Summary · issue` (`RtacV`): its variant with the merge, reviews, checks and linked sections hidden,
  and I1's issue title, properties and projects.

Screens swapped to the full-screen header (`Item / Toolbar` → `Item / Toolbar · full screen`, overrides kept):

- [ ] F2 (`vUcHq` → `vKQmD`), F4 (`u6dnEQ` → `xSohj`), F5 (`YkzFi` → `M3ohx`), F10 (`f0TUNz` → `Nro43`).
- [ ] SP35 (`kEW8i` → `RTEN3`), SP36 (`TN7lE` → `xLwkF`), CR1 (`KrcbH` → `G4MMo6`), I1 (`sLPGT` → `f8Wlul`).
- [ ] Item view / split (`a80hmX`): its toolbar `c5JqCZ` → `Eph28`, so D3, H6, T12 and T15 (full pages) show
  "back to the panel".
- [ ] M2 (`LDcGG`), the hand-drawn header with the item menu trigger (`ihcgM`): its switch `UBtkE` → `z7jx8b`, an
  instance of `Item / Arrangement · back to the panel`.
- [ ] SP5 (`mAAFx`), the hand-drawn panel header (`YPRJ7`): its switch `jgWxz` → `uyvi3`, an instance of
  `Item / Arrangement · open full screen`.
- [ ] SP35 (`i3LZ1T`): its hand-drawn `Stack map` (`JnxKj`) → an instance of `Stack / Map` (`MlkRn`), same tree.

New screens in App · Pull request (`XN8vf`), three new rows (`Q2AMop`, `z5ZFg`, `zgEPY`):

- [ ] `F18 · PR full screen · two columns, the thread scrolled` (slot `F9QSe`, screen `lsBpS`): 1440 × 900, sidebar
  expanded, full-screen header, `Item / Summary · pull request` on the left, the timeline (F5's description and
  thread) on the right, 684 px, scrolled past the description with a review cut by the header.
- [ ] `F19 · PR full screen · a wide window, stacked` (slot `S21fYP`, screen `P1Y0d`): 1920 × 1080; the timeline at
  its 920 px cap, 284 px empty on the right; the stack map shown at the top of the summary (#1186, #1187 current,
  "#1187 can't merge yet: 2 checks failing"); scrolled to the end, the composer in view.
- [ ] `F20 · PR in a panel dragged wide · two columns` (slot `qi46s`, screen `uAkdB`): 1728 × 1080, sidebar on its
  rail, My work at 572 px, the panel at 1100 px with the panel's header and the same two columns (timeline 660, 580
  of thread), not scrolled.
- [ ] `F21 · PR in the panel at 560 px · one column` (slot `mvYZE`, screen `R5O1zL`): F1's screen as it is now, one
  column, with "Open full screen" in the header.
- [ ] `F22 · Question · PR full screen on a small window · one column` (slot `E4rAB5`, amber, screen `ktjje`):
  900 × 1180, the rail and `Item view / PR panel` at full width, one column; its arrangement button hidden. The
  question: hide it, or keep it disabled with a tooltip.
- [ ] `F23 · Issue full screen · two columns` (slot `xdBrQ`, screen `zesTQ`): 1440 × 900, `Item / Summary · issue`
  with a two-line title, I1's description and thread, not scrolled.

Removed (codes stay retired):

- [ ] App · My work: `D2 · Sidebar collapsed · List · Item in modal` (`iWJgr`).
- [ ] App · Issue: `Slot · I3 · Issue in modal · not planned and locked` (`NVC4S`). The not-planned, locked,
  read-only composer state has no screen of its own now; its parts (`Activity / Composer · read-only`, `fBQzF`) stay.
- [ ] App · Stacked pull requests: `Slot · SP33 · In a modal, stack of two` (`juKQy`), `Slot · SP34 · In a modal,
  stack of ten` (`p7LZ5W`), and their row (`ZUP0e`).
- [ ] App · Project, D4's Display popover (`Cpz18`): the "Open items in" section (`v1aU3`: Panel, Modal, Full page,
  "Links to an item always open the full page."): the arrangement is no longer remembered.

Text:

- [ ] E1 command menu (`XfNMb`) and L1 context menu (`nUeuZ`): "Open as full page" → "Open full screen" (the ⇧F
  key next to them is unchanged).
- [ ] Overview (`hbsg2`): point 3 describes the panel and full screen, the 1000 px split and how ↵ / Esc move between
  them (was panel, modal or full page, a 760 px split and ⇧F).
- [ ] Captions without the modal: SP walk (`w3Oqo`), SP stack map (`vlL0h`), the issue thread (`r73zdO`), CR's
  "Review files" (`yWWEN`).

Left for a later round:

- The older full-page screens (F2, F4, F5, F10, SP35, SP36, CR1, I1, and D3, H6, T12, T15 through
  `Item view / split`) still show the old page layout (a 760 px main column and a 340 px side column; SP35/36 with a
  stack column on the left). Only their header changed. F18–F23 are the new layout.
- Whether ⇧F stays as the menus' key for "Open full screen" next to ↵.
- `docs/design/githq/DECISIONS.md` D9 still describes three arrangements.
