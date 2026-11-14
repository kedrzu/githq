# Code review: find in the diff

The diff is a virtual list, so the browser's own find misses lines off screen. ⌘F opens a find bar like VS Code's,
floating at the top right of the diff over the code: every match in the diff's shown lines is marked in the code, the
current one stronger, and ↵ ⇧↵, ⌘G ⇧⌘G or F3 ⇧F3 walk them, the line cursor (D44) landing on each match's row. Spec:
PR #292. Approved by the owner on 2026-11-14: D47 in `docs/design/code-review/DECISIONS.md`.
Base: `7333c8bd`.

## Round 1 · agent in the app, from the brief

Asked (`.context/review-find-brief.md`): the bar with matches marked and one current, the three toggles on, still
searching, no results, invalid pattern, too slow, unified; CR29's keys. Changed: three variables, two new component
families, seven screens in a new group "Find in the diff" in App · Code review (`CEDLB`), CR29.

- [x] Variables: new `find-match` `#E3B3413D`, `find-match-current` `#E3B34175`, `find-match-outline` `#F2CC60`.
  Marks keep the syntax colour of what they cover on context, added and deleted lines.
- [x] Components · Code review › Diff parts (`TiIVN`): new frame "Find marks" (`H3xnU`) with `Diff / Find mark`
  (`jtxWW`: 16 px high, radius 3, `$find-match`, no padding, the text `eWWS6` in `$mono` 12 taking the syntax colour)
  and `Diff / Find mark · current` (`y6jJX`: `$find-match-current`, 1 px inner `$find-match-outline`), plus a sample
  "Over syntax colours" (`kExbt`): marks over a comment, a function name, a string and properties on context, changed,
  deleted and added split rows.
- [x] Components · Code review › Chrome parts (`q7guFW`): new frame "Find bar" (`bpIbv`) with `Review / Find bar`
  (`iWL1w`): a card in `$bg-3`, 1 px `$border-2`, radius 8, shadow 0 6 20 `#00000080`, padding 5, gap 4; the field
  (`JtOla`) in the file filter's look (300 × 26, `$bg-2`, `$control-border`, radius 6) holding the search icon, the
  query in `$mono` 12 with the caret, and three `Review / Toggle`s at 20 × 20 as the filter's `.*` (`case-sensitive`
  `n1zkb`, `whole-word` `ypucI`, `regex` `X9kNBh`); the counter (`xiEGC`): position "3 of 128" in `$mono` 12 (`bYtZo`),
  a dim "+" hidden (`h5so0`), a message in `$font` 12 hidden (`b1agyA`); `Button / icon`s `arrow-up` (`l1hPgf`),
  `arrow-down` (`p3Z4G`), `x` (`WASZ7`).
- [x] Find bar states, instances of the base: `· searching` (`b4R8L`, the "+" shown), `· no results` (`xV6g3`, "No
  results" in `$fg-2`, field border `$red-quiet`, ↑ ↓ at 0.4), `· invalid pattern` (`jjhPD`, `.*` on, query and field
  border `$red`, "Invalid regular expression" in `$red`, ↑ ↓ at 0.4), `· too slow` (`IxL6A`, `.*` on, field border
  `$red-quiet`, "Pattern too slow" in `$red`, ↑ ↓ at 0.4, no count). A toggle on uses `Review / Toggle · on`'s look.
- [x] App · Code review (`CEDLB`): new group "Find in the diff" (`woSqk`), rows `j3lUuj` and `HagYL`, each screen a
  copy of the line cursor screens with the bar 24 px from the diff's right edge, 8 px from its top, and the code in
  syntax-coloured spans:
  - CR137 (`X56AE`) matches marked, one current: `review`, "3 of 128", marks in a comment on both halves of a context
    line (one match), in `needsReview` on a deleted half, `this.review` on the current added half (the cursor's row,
    line 46) and in a string; a context line counts once.
  - CR138 (`iBbgd`) Match Case, Whole Word and Regex on: `fo+\b`, "1 of 12"; `foo` marked, `Foo`, `food`, `for` not.
  - CR139 (`D1RJK`) still searching: "3 of 128+", the "+" dim; engine.test.ts still loading rows. Chosen over a
    spinner: the grey bars already say what is loading. The same "+" marks a line that hit the cap of 1000 marks.
  - CR140 (`TGd0A`) no results: `zzz`, no marks, the cursor stays.
  - CR141 (`CsmqY`) invalid pattern: `(foo` with Regex on, as CR28's invalid filter.
  - CR142 (`P8qDC`) too slow: `(a+)+$`, stopped past a time budget, no count, no marks.
  - CR143 (`C5Zew`) unified, a copy of CR123: "5 of 128", the current match on the added line 46; CR123's threads
    left out of the copy.
- [x] CR29 keys sheet (`GOlGu`): new column "Finding" (`d8lKcb`): ⌘F "Find in the diff", ⌘G ⇧⌘G "Next and previous
  match", F3 ⇧F3 "The same, with function keys", ↵ ⇧↵ "The same, in the find field", Esc "Close the bar, in the
  field"; the sheet (`upmZG`) 840 → 1120 px wide, x 300 → 160; caption (`V0GWA`) gains a sentence on find, and notes
  that ⌘G stays Suggest a change inside a comment box.
- [x] Layout: `CEDLB` grew 2244 px; every top-level frame from the menus row down moved down as much.

## Round 2 · implementation

Forced by: `styles/tokens.test.ts` and axe on the `ReviewDiffRow` marked stories. `#E3B341` at 24% and 46% took the
comment colour over an added line to 3.3:1 and 2:1. The owner chose a darker amber (2026-11-14).

- [x] Variable `find-match`: `#E3B3413D` → `#BB800914` (8%).
- [x] Variable `find-match-current`: `#E3B34175` → `#BB800924` (14%); `find-match-outline` unchanged.

## Round 3 · implementation

Forced by: axe's target-size rule (WCAG 2.5.8) on the `ReviewFindBar` stories: toggles 1 px apart fail it.

- [x] `Review / Find bar` (`iWL1w`): the gap between the three toggles 1 → 4 px (built; frame `Toggles` `M4y1z` updated).

## Round 4 · implementation

Forced by: the app's shared popover shadow and a state the design didn't draw.

- [x] `Review / Find bar` (`iWL1w`): the built bar uses the app's `$shadow-popover` (0 8 24 at 40%) instead of the
  frame's 0 6 20 `#00000080`; the difference is too small to redraw.
- [x] No matches while files are still read: the counter says "No results yet" (not drawn; the "+" of CR139 needs a
  count to follow).

## Round 5 · owner, built at once

Asked: "a light amber ring is fine, with a little room, reaching slightly past the word": a match at 8% was hardly seen
on an added line. The ring is drawn outside the word, so no text moves (D7); at 60% it keeps 3:1 on every line's colour
(`tokens.test.ts`), 40% did not.

- [x] Variable `find-match-ring`: new, `#D2992299`.
- [x] `Diff / Find mark` (`jtxWW`): padding `[0, -2]`, no fill; new `Fill` (`PtqIh`), fill `$find-match` reaching 2 px
  past the word, radius 4, 1 px ring `$find-match-ring` outside.
- [x] `Diff / Find mark · current` (`y6jJX`): the same geometry, `Fill` in `$find-match-current` with its ring
  `$find-match-outline` (was a 1 px inner stroke on the mark).
