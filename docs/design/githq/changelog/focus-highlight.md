# Focus highlight

Where the cursor is, in code review and on a pull request's thread, is shown with one subtle mark: the element's own
border in `current-edge` (as the current file's edge), never the full accent and never an added edge. Code review's
focused thread shows `H` on Resolve thread as it shows `R` on Reply…. A code thread's comment reads as on GitHub: a
header row with the avatar, author and age, and the body under it with no indent, comments divided by a line. The
comment under the reading cursor is tinted `current-tint` (the accent at 8 %) over its whole part of the card, its
code excerpt included when it is the first comment.
Base: `4391ee74`.

## Round 1 · agent brief

Asked (`.context/focus-highlight-brief.md`): the comment's header row and unindented body, dividers between a thread's
comments, `current-edge` for the focused thread and the linked looks, `H` on the focused thread's Resolve thread, and
an amber `Variants · How the comment under the reading cursor shows`: A the header row tinted `current-header`
(recommended), B the dividers around it lit `current-edge`, C nothing but the thread's border. Changed: 8 components,
three new screens F34–F36; moving the avatar dropped 251 overrides on 46 instances, all restored from `HEAD`.

- [x] Review / Comment (`IHFo8`): avatar column + indented body → `Header` row (`y516VN`, was `Comment meta`;
  avatar 20 px, author, age, notes, ⋯; padding 12/12/6/12) and `Body` (`AdsFm`, full width, padding 6/12/12/12);
  new `Divider` (`V6rFj3`, 1 px `$border`, hidden by default); wrapper `Quuge` removed.
- [x] Review / Comment · editing (`n2U14`): its body's padding to the new layout.
- [x] (superseded by round 2, not built) Review / Comment · current (`fNNF4`): tint behind the whole comment → the header row in `$current-header`
  (Variant A's look until picked).
- [x] Review / Thread (`ce2EO`): body `jHOqT` gap and padding 0; the second comment (`qrcqS`) shows its divider.
- [x] Activity / Code thread (`BGMhn`): the excerpt in a new `Excerpt row` (`a24mp`); body `TivsZ` gap and padding
  0; `Comment 2` (`uIXia`) shows its divider; new `Comment 3` (`TKerH`), hidden by default.
- [x] Review / Thread · focused (`M54IUE`): border `$accent` → `$current-edge`; Resolve thread shows `H`.
- [x] Activity / Comment · linked (`iMK9U`), Activity / Latest comment · linked (`xG3Wm`): `$accent` →
  `$current-edge`.
- [x] CR15's focused thread (`Do0Sf`): `$accent` → `$current-edge`.
- [x] A code review screen's `Thread` `OvKgC` replaced by an identical instance `U57Ff5` (overrides restored).
- [x] Activity / Review · sofiab (`t4Re0`): the comment under the cursor restored.
- [x] App · Pull request (`XN8vf`): new `Variants · How the comment under the reading cursor shows` (`pVY08`):
  `F34 · Variant A · The comment's header lit` (`gyjFw`), `F35 · Variant B · The lines around the comment lit`
  (`Q1J3fu`), `F36 · Variant C · Only the thread's border` (`t23cHK`).

## Round 2 · agent brief

Asked (`.context/focus-highlight-brief-2.md`): the owner rejected A–C (the header tint cuts the header off, lit
dividers can't be seen); a faint tint of the comment's whole part of the card instead, the code excerpt included when
the comment comes with it. Also: CR120–CR126 were each used by two screens. Changed: a new variable, two components,
F34–F36 replaced by F37–F38, the conversation set renumbered.

- [x] (superseded by round 3, not built) Variables: new `current-tint` = `#7B87F70D` (the accent at 5 %).
- [x] Review / Comment · current (`fNNF4`): header row tint `$current-header` → the whole comment `$current-tint`.
- [x] `Variants · How the comment under the reading cursor shows` (`pVY08`): F34–F36 deleted (codes retired); new
  `F37 · Variant D · The comment's whole part of the card, faintly tinted` (slot `KmZdO`, screen `HarMI`, the cursor
  on the middle comment) and `F38 · Variant D · On the first comment, with its code` (slot `o1bhI`, screen `mtZmU`;
  the code thread's `Excerpt row` `a24mp` takes `$current-tint` as an override).
- [x] The conversation set CR120–CR126 → CR153–CR159 (frame, slot, caption): `eOOkK`, `Y0S98J`, `cyUd6`, `j0LRr`,
  `WLGn5` (slot `YQPcq`), `qIKMX`, `QNbcB`. The line-cursor set keeps CR120–CR126.

## Round 3 · agent brief

Asked (`.context/focus-highlight-brief-3.md`): at 5 % the tint can't be seen on the page; the old 10.2 % lowered the
text's contrast. Variant D at 8 %, and a second strength, 6.5 %, to compare. Changed: the variable, F37–F38 renamed,
F39–F40 added. Measured over `$bg` `#0D1117`: 8 % gives about `#161A29` (`$fg` 15.9:1, `$fg-dim` 5.5:1, `$fg-3`
3.3:1), 6.5 % about `#141926` (16.1:1, 5.6:1, 3.3:1); both visible on a 2× export of the screen.

- [x] Variables: `current-tint` `#7B87F70D` → `#7B87F714` (8 %). `fNNF4` and F37–F38 follow.
- [x] F37 (`KmZdO`, `HarMI`, caption `QT9cp` / `Nyqmp`): renamed `F37 · Variant D · The comment's part of the card
  tinted at 8 %`; the note gives the new strength and contrast.
- [x] F38 (`o1bhI`, `mtZmU`, caption `lAxcx` / `qIqh2`): renamed `F38 · Variant D · On the first comment, with its
  code, at 8 %`.
- [x] New `F39 · Variant E · The comment's part tinted at 6.5 %` (slot `AQqg7`, screen `r3Cz0`): a copy of F37;
  `Review · sofiab` (`yv4iF`)'s Comment 2 overrides the fill with the raw `#7B87F711`.
- [x] New `F40 · Variant E · On the first comment, with its code, at 6.5 %` (slot `w205fV`, screen `YgM1w`): a copy of
  F38; `Review · sofiab` (`JwSn8`)'s Comment 1 and `Excerpt row` override the fill with `#7B87F711`.

## Round 4 · agent brief

Asked (`.context/focus-highlight-brief-4.md`): the owner picked Variant D at 8 % (`current-tint` `#7B87F714`). Settle
the Variants frame. Changed: F39–F40 deleted (codes retired), F37–F38 moved into the reading-cursor row and renamed,
the Variants frame deleted. F38's `Excerpt row` tint stays an override on an instance: `Review · sofiab` (`tvOv3`,
of `b1us0`) sets `B8zor/a24mp` to `$current-tint`.

- [x] `F39 · Variant E · The comment's part tinted at 6.5 %` (slot `AQqg7`, screen `r3Cz0`): deleted.
- [x] `F40 · Variant E · On the first comment, with its code, at 6.5 %` (slot `w205fV`, screen `YgM1w`): deleted.
- [x] F37 (slot `KmZdO`, screen `HarMI`, caption `QT9cp`): moved from `pVY08` to the end of `Row of screens · The
  reading cursor` (`TS9ng`), after F31; `F37 · Variant D · The comment's part of the card tinted at 8 %` →
  `F37 · The comment under the cursor, its part of the card tinted`.
- [x] F37's note (`Nyqmp`): "Recommended…" → the rule: the comment under the reading cursor is tinted `$current-tint`
  over its whole part of the card, divider to divider, edge to edge; the thread's border is `$current-edge`.
- [x] F38 (slot `o1bhI`, screen `mtZmU`, caption `lAxcx`): moved after F37 in `TS9ng`;
  `F38 · Variant D · On the first comment, with its code, at 8 %` → `F38 · On the first comment, its code tinted with
  it`.
- [x] F38's note (`qIqh2`): the rule for the first comment: its code excerpt is tinted with it; the thread's border is
  `$current-edge`.
- [x] `Variants · How the comment under the reading cursor shows` (`pVY08`): deleted.
