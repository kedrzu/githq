Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/bawdy-armadillo/githq.pen

Settled by the owner on 2026-11-10: D39–D45 in `docs/design/code-review/DECISIONS.md`. Screens in App · Code review
(`CEDLB`), group "Writing and the diff, refined".

## Shared components

- [ ] Activity / Editor (`OXAXr`): the footer's Markdown hint (icon `G7epo`, text `x0YOX`) is hidden. Before: file
  icon + "Markdown" at the left of the footer. After: nothing there, the buttons stay right. Every composer,
  reply box and editing box changes.
- [ ] Button / medium · primary (`t0PlX5`): its key (`ZBaFq`) is drawn in the accent's own colours: fill
  `#0D111729`, stroke `#0D111733`, glyph `#0D1117`. Before: the plain grey Kbd (`$bg-3`, `$border-2`,
  `$fg-2`) on the accent button. Every primary medium button changes.
- [ ] Diff / File header (`pAbDY`): the Viewed toggle (`KQcKb`) padding 3 × 8 → 5 × 8 (4 px taller). Every file
  header changes (collapsed and viewed too).

## The comment box (D39, D40)

- [ ] Review / New comment (`SAmev`), in Thread parts › Writing · on the editor (`AeXsY`): replaces Review /
  Comment box (`T0DNU`, deleted) and `· code changed` (`Q7LSPI`, deleted). Built on Activity / Editor. Head:
  where it goes. Format toolbar: Suggest a change (icon `file-diff`, ⌘G) first, then a rule, then the editor's
  own buttons. Footer: Cancel Esc, the second key's button, the first key's primary button. States:
  `· draft open` (`c0AL2N`), `· code changed` (`QNL7n`), `· not sent` (`p3KpyQ`, red "Not sent: {reason}."
  line, text kept), `· asks to discard` (`y4kGY9`, footer: "Discard what you wrote?", Keep writing Esc,
  Discard ↵).
- [ ] Review / Thread · replying (`eS728`): Activity / Code thread · replying with the review box, headed
  "Reply to …", no excerpt.
- [ ] Inset under its line on its side, as a thread: CR90 (single line), CR91 (range, draft open, suggestion as
  markdown), CR92 (reply), CR93 (unified: code changed, not sent).
- [ ] Esc with text asks in place (CR97); after Discard, a toast "Comment on line 51 discarded" with Restore ⌘Z for
  ten seconds reopens the box with its text (CR98).
- [ ] Existing screens now use the new box: CR70, CR71, CR72, CR73, CR74, CR83, CR87 (labels as before).

## The diff (D41–D44)

- [ ] File end (CR99): no 4 px closing strip and 12 px margin; a block ends with its 1 px border, 6 px radius, next
  file 8 px below. Pinned header pushed by the next one with the 8 px showing between.
- [ ] Diff / Gap (`tshOK`, renamed from `Diff / Gap · arrows`) replaces the old Diff / Gap (`sKcGj`, deleted): a
  48 px gutter cell with ↓ (20 below the hunk above) and ↑ (20 above the hunk below), the hunk header, the
  enclosing declaration only when it is a real one, the count at the right. States: `· hover` (`e6QSL`),
  `· focused` (`ioejG`), `· top of file` (`hKfCl`, only ↑), `· end of file` (`YaZfl`, only ↓), `· short`
  (`jg63B`, one ↕). A click elsewhere on the row shows all. Keyboard: the line cursor stops on the row, ↓/↑
  pick the arrow, ↵ expands (CR103). All 49 gaps in the screens swapped to it. (Row click, keyboard and hunk header corrected below.)
- [ ] Line hover (CR106): the hovered number turns `$accent` and underlined; Diff / Comment marker (`oy1ny`, lucide
  `message-square-plus`, 12 px, `$accent`) in the margin before it. No row tint. During a range drag the range
  takes `#7B87F72E` on its side and the numbers turn accent.
- [ ] Current file (CR108): Diff / File header · current (`GwweZ`), · collapsed, current (`zUTmp`), · viewed,
  current (`ruHZc`): fill `#7B87F71F`, chevron `$accent`; the block's stroke `#7B87F799`. Reading line a third
  down, never drawn.

## Loading (D45)

- [ ] Diff / File note · binary (`aPT6Y`) and · too large (`PslUs`): the final one-line note, shown from the first
  frame when the patch says so (CR111). (Corrected below: too large is not known from the patch.)
- [ ] Bars follow the patch's hunks with Diff / Gap rows in place; added bars `#2EA0434D`, deleted `#F851494D`,
  context `$bg-3`; split pairs a changed line into one row (CR111).
- [ ] A guessed height (whitespace hidden, past 3,000 files) reserves bars for the patch's count, an upper bound
  (CR113). (Corrected below: grey, close not an upper bound, no 3,000-file case.)

## Corrections (2026-11-10, follow-up)

Decisions amended: D32, D40, D42, D44, D45 in `docs/design/code-review/DECISIONS.md`.

- [ ] CR91 (`X9Z22`): the right side's numbers of the range read 41 on every row; now 48, 49, 50, 51 (rows `nXBGb`,
  `dmW08`, `WgWrC`, `TR3pv`, text `NIdDm`).
- [ ] Diff / Gap (`tshOK`): the hunk header (`h3RAg`, "@@ −48,7 +48,9 @@") is hidden in the component. Before: shown
  in CR103's five gaps (the other 49 already hid it). After: no hunk header anywhere; our hunks are not git's (D42).
- [ ] Diff / Gap: a click on the row away from the arrows shows 20 lines toward the nearest hunk, the one on the
  reading line's side (the hunk above for a gap below the reading line, the hunk below for one above it); a gap of 20
  or fewer opens whole. Before: a row click showed all. Hovering the row lights the arrow the click takes (D42).
- [ ] Keyboard for gaps: no line cursor. ↓ ↑ scroll the diff by a line; E expands the gap nearest the reading line, 20
  toward its hunk; ⇧E shows all of it. Before: the line cursor stopped on the row, ↓/↑ picked the arrow, ↵ expanded.
- [ ] Diff / Gap · focused (`ioejG`): stays, as Tab focus on an arrow; its hint "↓ ↵ shows 20 below line 47" →
  "↵ shows 20 below line 47".
- [ ] Diff / Gap · reset by a push (`PujfA`, new): "Context you expanded here was reset by the push · 134 lines" in
  `$fg-2`. CR62's gap (`o7b9N`) is now this state; before it was a plain Diff / Gap with the text overridden.
- [ ] CR103 (`DE6MF`): the third excerpt is "Hover: the row shows 20 toward the nearest hunk" (`rNiAV`); the fourth,
  before "Keyboard: the line cursor stops on the row", is "E: 20 toward the nearest hunk" (`DPR1z`): lines 66–67
  shown under the hunk, then the gap with 114 lines left. Caption rewritten.
- [ ] CR29 key sheet (`upmZG`): "Line by line" ↓ ↑ → "Scroll by a line"; new row in Files, after Collapse: E ⇧E
  "Show 20 hidden lines, or all" (`DaMeF`). Caption: C takes the current file's line at the reading line.
- [ ] C acts on the current file's line at the reading line, or on its line nearest to it while the file is held off
  the line (D44, D32), so C, V and Space always hit the same file. Captions of CR70 and CR108 say so.
- [ ] CR97 (`H0RGe`) caption: focus stays in the field, so ↵ there means Discard (not a new line), and typing anything
  takes the question away and goes back to writing.
- [ ] CR98 (`P2dmJj`): the toast's Dismiss is Button / label, no key (`q8CWm`); before, it showed Esc, which leaves
  the review. The toast sits above the pending review's toolbar (`OxcCo`, new, as in CR35) at the foot of the diff
  (`i7s5y`). Restore ⌘Z works only while no text field has focus. The Toast component itself is unchanged.
- [ ] Placeholders before the patch (D45, CR115 `kqrKY`, new screen, a copy of CR60): the patch is a separate,
  paginated request, so until a file's page arrives it is its header and D38's grey bars, as many as its additions and
  deletions, no tint, no gap rows; every row of the file list spins; a 0/0 file is only its header and its list row
  carries no "binary" tag or size yet. Status bar: "Fetching patches · the list is complete, 42 files · their patches
  on their way".
- [ ] Once the patch is in (D45): no patch, 0/0 and MODIFIED, ADDED or DELETED → the binary note; RENAMED with 0/0 →
  Diff / File note · renamed (`s6lIi`, new: icon `file-symlink`, "Renamed, no changes"), the header showing R and
  "from …"; a patch → tinted hunk-shaped bars; no patch but lines → the grey bars stay, sized from the counts.
- [ ] CR111 (`v86U6s`): the too-large file (recorded.json) is replaced by a pure rename, outbox.ts from
  src/sync/pending.ts, with the renamed note. Caption: the patch arrives by its own request; "too large" isn't in it.
- [ ] Too large (D35, bytes) shows once the blob says so: CR116 (`Cx7An`, new): schema.json +3 −1 drawn with tinted
  bars between "30,112 lines above" and "31,276 lines below", then the same file as header and the too-large note.
  Before: CR111 showed the too-large note from the first frame.
- [ ] CR113 (`UYzC8`), renamed "… reserved with grey bars": with whitespace hidden the bars keep the patch's layout
  but are `$bg-3` (were red and green); no "past GitHub's 3,000-file listing" case (those files aren't in the diff,
  D35); the guess is close, D7's anchor absorbs what differs (was "an upper bound, can only shrink").
- [ ] CR60 (`M4K8C4`): the two arriving files (both added) take green bars on the right (`#2EA0434D`), the patch being
  in; caption names the order list → patches → contents and points at CR115. CR20 (`d4ITC`) caption points at CR115.
- [ ] CR65 (`dOdiu`): the three hand-drawn notes are Diff / File note · binary instances; caption: binary is known
  once the patch page is in (no patch, 0/0), only the header before.
- [ ] CR67 (`Loze3`): schema.json's hand-drawn note is Diff / File note · too large ("Too large to diff here · 4.2 MB,
  61,400 lines"); caption: shown once the blob says so, the bars turning into the note (CR116).
- [ ] CR88, CR89 captions: the grey bars are the look before a file's patch arrives, and for a file with lines but no
  patch; once the patch is in they take its hunk layout and tint (CR111).
