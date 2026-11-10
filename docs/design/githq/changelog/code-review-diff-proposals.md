Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/aloof-dingo/githq.pen

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
  pick the arrow, ↵ expands (CR103). All 49 gaps in the screens swapped to it.
- [ ] Line hover (CR106): the hovered number turns `$accent` and underlined; Diff / Comment marker (`oy1ny`, lucide
  `message-square-plus`, 12 px, `$accent`) in the margin before it. No row tint. During a range drag the range
  takes `#7B87F72E` on its side and the numbers turn accent.
- [ ] Current file (CR108): Diff / File header · current (`GwweZ`), · collapsed, current (`zUTmp`), · viewed,
  current (`ruHZc`): fill `#7B87F71F`, chevron `$accent`; the block's stroke `#7B87F799`. Reading line a third
  down, never drawn.

## Loading (D45)

- [ ] Diff / File note · binary (`aPT6Y`) and · too large (`PslUs`): the final one-line note, shown from the first
  frame when the patch says so (CR111).
- [ ] Bars follow the patch's hunks with Diff / Gap rows in place; added bars `#2EA0434D`, deleted `#F851494D`,
  context `$bg-3`; split pairs a changed line into one row (CR111).
- [ ] A guessed height (whitespace hidden, past 3,000 files) reserves bars for the patch's count, an upper bound
  (CR113).
