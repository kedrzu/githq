# Focus highlight

Where the cursor is, in code review and on a pull request's thread, is shown with one subtle mark: the element's own
border in `current-edge` (as the current file's edge), never the full accent and never an added edge. Code review's
focused thread shows `H` on Resolve thread as it shows `R` on Reply…. A code thread's comment reads as on GitHub: a
header row with the avatar, author and age, and the body under it with no indent, comments divided by a line. The
comment under the reading cursor is no longer tinted behind its text; how it is marked instead is the owner's pick.
Base: `4391ee74`.

## Round 1 · agent brief

Asked (`.context/focus-highlight-brief.md`): the comment's header row and unindented body, dividers between a thread's
comments, `current-edge` for the focused thread and the linked looks, `H` on the focused thread's Resolve thread, and
an amber `Variants · How the comment under the reading cursor shows`: A the header row tinted `current-header`
(recommended), B the dividers around it lit `current-edge`, C nothing but the thread's border. Changed: 8 components,
three new screens F34–F36; moving the avatar dropped 251 overrides on 46 instances, all restored from `HEAD`.

- [ ] Review / Comment (`IHFo8`): avatar column + indented body → `Header` row (`y516VN`, was `Comment meta`;
  avatar 20 px, author, age, notes, ⋯; padding 12/12/6/12) and `Body` (`AdsFm`, full width, padding 6/12/12/12);
  new `Divider` (`V6rFj3`, 1 px `$border`, hidden by default); wrapper `Quuge` removed.
- [ ] Review / Comment · editing (`n2U14`): its body's padding to the new layout.
- [ ] Review / Comment · current (`fNNF4`): tint behind the whole comment → the header row in `$current-header`
  (Variant A's look until picked).
- [ ] Review / Thread (`ce2EO`): body `jHOqT` gap and padding 0; the second comment (`qrcqS`) shows its divider.
- [ ] Activity / Code thread (`BGMhn`): the excerpt in a new `Excerpt row` (`a24mp`); body `TivsZ` gap and padding
  0; `Comment 2` (`uIXia`) shows its divider; new `Comment 3` (`TKerH`), hidden by default.
- [ ] Review / Thread · focused (`M54IUE`): border `$accent` → `$current-edge`; Resolve thread shows `H`.
- [ ] Activity / Comment · linked (`iMK9U`), Activity / Latest comment · linked (`xG3Wm`): `$accent` →
  `$current-edge`.
- [ ] CR15's focused thread (`Do0Sf`): `$accent` → `$current-edge`.
- [ ] A code review screen's `Thread` `OvKgC` replaced by an identical instance `U57Ff5` (overrides restored).
- [ ] Activity / Review · sofiab (`t4Re0`): the comment under the cursor restored.
- [ ] App · Pull request (`XN8vf`): new `Variants · How the comment under the reading cursor shows` (`pVY08`):
  `F34 · Variant A · The comment's header lit` (`gyjFw`), `F35 · Variant B · The lines around the comment lit`
  (`Q1J3fu`), `F36 · Variant C · Only the thread's border` (`t23cHK`).
