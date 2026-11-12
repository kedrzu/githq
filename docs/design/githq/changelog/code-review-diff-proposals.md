Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/aloof-dingo/githq.pen

Settled by the owner on 2026-11-10: D39–D45 in `docs/design/code-review/DECISIONS.md`. Screens in App · Code review
(`CEDLB`), group "Writing and the diff, refined".

## Shared components

- [x] Activity / Editor (`OXAXr`): the footer's Markdown hint (icon `G7epo`, text `x0YOX`) is hidden. Before: file
  icon + "Markdown" at the left of the footer. After: nothing there, the buttons stay right. Every composer,
  reply box and editing box changes.
- [ ] Button / medium · primary (`t0PlX5`): its key (`ZBaFq`) is drawn in the accent's own colours: fill
  `#0D111729`, stroke `#0D111733`, glyph `#0D1117`. Before: the plain grey Kbd (`$bg-3`, `$border-2`,
  `$fg-2`) on the accent button. Every primary medium button changes.
- [ ] Diff / File header (`pAbDY`): the Viewed toggle (`KQcKb`) padding 3 × 8 → 5 × 8 (4 px taller). Every file
  header changes (collapsed and viewed too).

## The comment box (D39, D40)

- [x] Review / New comment (`SAmev`), in Thread parts › Writing · on the editor (`AeXsY`): replaces Review /
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
- [x] Esc with text asks in place (CR97); after Discard, a toast "Comment on line 51 discarded" with Restore ⌘Z for
  ten seconds reopens the box with its text (CR98).
- [x] Existing screens now use the new box: CR70, CR71, CR72, CR73, CR74, CR83, CR87 (labels as before).

## The diff (D41–D44)

- [x] File end (CR99): no 4 px closing strip and 12 px margin; a block ends with its 1 px border, 6 px radius, next
  file 8 px below. Pinned header pushed by the next one with the 8 px showing between.
- [x] Diff / Gap (`tshOK`, renamed from `Diff / Gap · arrows`) replaces the old Diff / Gap (`sKcGj`, deleted): a
  48 px gutter cell with ↓ (20 below the hunk above) and ↑ (20 above the hunk below), the hunk header, the
  enclosing declaration only when it is a real one, the count at the right. States: `· hover` (`e6QSL`),
  `· focused` (`ioejG`), `· top of file` (`hKfCl`, only ↑), `· end of file` (`YaZfl`, only ↓), `· short`
  (`jg63B`, one ↕). A click elsewhere on the row shows all. Keyboard: the line cursor stops on the row, ↓/↑
  pick the arrow, ↵ expands (CR103). All 49 gaps in the screens swapped to it. (Row click, keyboard and hunk header corrected below.)
- [x] Line hover (CR106): the hovered number turns `$accent` and underlined; Diff / Comment marker (`oy1ny`, lucide
  `message-square-plus`, 12 px, `$accent`) in the margin before it. No row tint. During a range drag the range
  takes `#7B87F72E` on its side and the numbers turn accent.
- [x] Current file (CR108): Diff / File header · current (`GwweZ`), · collapsed, current (`zUTmp`), · viewed,
  current (`ruHZc`): fill `#7B87F71F`, chevron `$accent`; the block's stroke `#7B87F799`. Reading line a third
  down, never drawn.

## Loading (D45)

- [x] Diff / File note · binary (`aPT6Y`) and · too large (`PslUs`): the final one-line note, shown from the first
  frame when the patch says so (CR111). (Corrected below: too large is not known from the patch.)
- [x] Bars follow the patch's hunks with Diff / Gap rows in place; added bars `#2EA0434D`, deleted `#F851494D`,
  context `$bg-3`; split pairs a changed line into one row (CR111).
- [x] A guessed height (whitespace hidden, past 3,000 files) reserves bars for the patch's count, an upper bound
  (CR113). (Corrected below: grey, close not an upper bound, no 3,000-file case.)

## Corrections (2026-11-10, follow-up)

Decisions amended: D32, D40, D42, D44, D45 in `docs/design/code-review/DECISIONS.md`.

- [x] CR91 (`X9Z22`): the right side's numbers of the range read 41 on every row; now 48, 49, 50, 51 (rows `nXBGb`,
  `dmW08`, `WgWrC`, `TR3pv`, text `NIdDm`).
- [x] Diff / Gap (`tshOK`): the hunk header (`h3RAg`, "@@ −48,7 +48,9 @@") is hidden in the component. Before: shown
  in CR103's five gaps (the other 49 already hid it). After: no hunk header anywhere; our hunks are not git's (D42).
- [x] Diff / Gap: a click on the row away from the arrows shows 20 lines toward the nearest hunk, the one on the
  reading line's side (the hunk above for a gap below the reading line, the hunk below for one above it); a gap of 20
  or fewer opens whole. Before: a row click showed all. Hovering the row lights the arrow the click takes (D42).
- [x] Keyboard for gaps: no line cursor. ↓ ↑ scroll the diff by a line; E expands the gap nearest the reading line, 20
  toward its hunk (⇧E was planned for all of it, but it is Re-run failed checks; see below). Before: the line cursor stopped on the row, ↓/↑ picked the arrow, ↵ expanded.
- [x] Diff / Gap · focused (`ioejG`): stays, as Tab focus on an arrow; its hint "↓ ↵ shows 20 below line 47" →
  "↵ shows 20 below line 47".
- [x] Diff / Gap · reset by a push (`cpAO2`, new): "Context you expanded here was reset by the push · 134 lines" in
  `$fg-2`. CR62's gap (`EIeGW`) is now this state; before it was a plain Diff / Gap with the text overridden.
- [x] CR103 (`DE6MF`): the third excerpt is "Hover: the row shows 20 toward the nearest hunk" (`rNiAV`); the fourth,
  before "Keyboard: the line cursor stops on the row", is "E: 20 toward the nearest hunk" (`DPR1z`): lines 66–67
  shown under the hunk, then the gap with 114 lines left. Caption rewritten.
- [x] CR29 key sheet (`upmZG`): "Line by line" ↓ ↑ → "Scroll by a line"; new row in Files, after Collapse: E
  "Show 20 more hidden lines" (`E0Jd8z`). Caption: C takes the current file's line at the reading line.
- [x] C acts on the current file's line at the reading line, or on its line nearest to it while the file is held off
  the line (D44, D32), so C, V and Space always hit the same file. Captions of CR70 and CR108 say so.
- [x] CR97 (`H0RGe`) caption: focus stays in the field, so ↵ there means Discard (not a new line), and typing anything
  takes the question away and goes back to writing.
- [x] CR98 (`P2dmJj`): the toast's Dismiss is Button / label, no key (`GlONd`); before, it showed Esc, which leaves
  the review. The toast sits above the pending review's toolbar (`H3uqds`, new, as in CR35) at the foot of the diff
  (`UghpC`). Restore ⌘Z works only while no text field has focus. The Toast component itself is unchanged.
- [x] Placeholders before the patch (D45, CR115 `mZUZV`, new screen, a copy of CR60): the patch is a separate,
  paginated request, so until a file's page arrives it is its header and D38's grey bars, as many as its additions and
  deletions, no tint, no gap rows; every row of the file list spins; a 0/0 file is only its header and its list row
  carries no "binary" tag or size yet. Status bar: "Fetching patches · the list is complete, 42 files · their patches
  on their way".
- [x] Once the patch is in (D45): no patch, 0/0 and MODIFIED, ADDED or DELETED → the binary note; RENAMED with 0/0 →
  Diff / File note · renamed (`NGjwk`, new: icon `file-symlink`, "Renamed, no changes"), the header showing R and
  "from …"; a patch → tinted hunk-shaped bars; no patch but lines → the grey bars stay, sized from the counts.
- [x] CR111 (`v86U6s`): the too-large file (recorded.json) is replaced by a pure rename, outbox.ts from
  src/sync/pending.ts, with the renamed note. Caption: the patch arrives by its own request; "too large" isn't in it.
- [x] Too large (D35, bytes) shows once the blob says so: CR116 (`BSq0n`, new): schema.json +3 −1 drawn with tinted
  bars between "30,112 lines above" and "31,276 lines below", then the same file as header and the too-large note.
  Before: CR111 showed the too-large note from the first frame.
- [x] CR113 (`UYzC8`), renamed "… reserved with grey bars": with whitespace hidden the bars keep the patch's layout
  but are `$bg-3` (were red and green); no "past GitHub's 3,000-file listing" case (those files aren't in the diff,
  D35); the guess is close, D7's anchor absorbs what differs (was "an upper bound, can only shrink").
- [x] CR60 (`M4K8C4`): the two arriving files (both added) take green bars on the right (`#2EA0434D`), the patch being
  in; caption names the order list → patches → contents and points at CR115. CR20 (`d4ITC`) caption points at CR115.
- [x] CR65 (`dOdiu`): the three hand-drawn notes are Diff / File note · binary instances; caption: binary is known
  once the patch page is in (no patch, 0/0), only the header before.
- [x] CR67 (`Loze3`): schema.json's hand-drawn note is Diff / File note · too large ("Too large to diff here · 4.2 MB,
  61,400 lines"); caption: shown once the blob says so, the bars turning into the note (CR116).
- [x] CR88, CR89 captions: the grey bars are the look before a file's patch arrives, and for a file with lines but no
  patch; once the patch is in they take its hunk layout and tint (CR111).
- [x] Diff / Row · unified, loading (`UMKkg`) and · split, loading (`JfZR9`): the bars are no longer pushed in by
  padding (unified 108, split 48 per side) but stand after the same number columns as the code rows: unified Old
  (`DNCQ9`, 36, right), New (`X3NDj`, 44, right) and a 28 px sign spacer (`TE4Cj`); split No per side (`Qpaq0`,
  `yHREz`, 36, right, gap 12). `$fg-dim`, mono 11, empty by default, so a file before its patch looks as before. Once
  the patch is in its numbers come from the hunk headers and are filled in: CR60, CR111, CR113, CR116 (whose gaps now
  read "8,112 lines above" and "53,276 lines below", so the numbers keep four digits). The bars still start where the
  code will.
- [x] No ⇧E for a whole gap: ⇧E is a pull request's Re-run failed checks (`PULL_REQUEST_COMMAND_KEYS`), which the
  review keeps. E shows 20 more each time it is pressed; the command menu's "Show all hidden lines" opens the whole gap
  nearest the reading line (D42). CR29's row (`E0Jd8z`) lost its ⇧E key (`VZFSa`, deleted) and reads "Show 20 more
  hidden lines"; the captions of CR29 (`V0GWA`) and CR103 (`dj9sp`) say so.

## While building M1 (2026-11-11)

Decisions amended: D42, D43.

- [x] Diff / Gap (`tshOK`): the gutter (`f0FF6s`) lays its arrows side by side, each 24 × 24 (`EFIc9`, `roUZs`), the
  gutter 24 tall; the row is 26 px. Before: stacked, 18 px each (38 px row). Every gap state and all 56 gaps in the
  screens follow (D42, WCAG 2.5.8).
- [x] Diff / Gap · reset, nothing hidden (`by8z8`, new): no arrows, "Context you expanded here was reset by the push"
  with no count, for a gap the threads' code shows whole after a push reset its context.
- [x] Diff / Gap · focused (`ioejG`): its "↵ shows 20 below line 47" is now built, not only drawn.
- [x] The enclosing declaration: signatures broken over lines (`async load(`) count; of calls only `describe`, `it`,
  `test` (D42).
- [x] The number column widens with the file's longest number so the comment marker always fits (D43).

## While building M2 (2026-11-11)

Decision amended: D44.

- [x] Diff / File header · current (`GwweZ`), · collapsed, current (`zUTmp`), · viewed, current (`ruHZc`): fill
  `#7B87F71F` → `#7B87F70F` (accent 12% → 6%), so a deleted file's red "D" keeps AA on it (D30). CR108 follows.
- [x] D44's behaviour: the reading line slides at both ends; the gap between files belongs to the file below; Space, N
  and landing hold a file; V moves on whether viewed files show or not; C takes N's thread only in the current file; a
  file leaving the diff goes when it leaves the top of the screen.

## While building M3 (2026-11-12)

Decisions amended: D42, D45.

- [x] CR115 (`mZUZV`): the status bar's line (`kDZ7q/YBQPD/unZbw`) reads "Reading the changes" (was "Fetching patches ·
  the list is complete, 42 files · their patches on their way"); with more than one page, "· 3 of 30 pages".
- [x] A gap never hides a single line; the CR62 notice goes on the first gap that still hides lines (D42).
- [x] D45: placeholder rows hold the position as lines; 0/0 files only a header before the patch; a binary verdict's
  note survives a failed blob; a renamed 0/0 file is "Renamed, no changes" only with the same blobs.
