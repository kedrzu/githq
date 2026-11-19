# Review comments redesign

A review thread in code review's diff (`Review / Thread`) was a grey bubble of flat comments in a dim grey, Reply… and
Resolve sharing one row: unlike a comment anywhere else in githq, where it is a card with a head band and a ⋯ menu.
This redesign brings review comments, in the diff and in a pull request's code threads, into the comment cards'
family. Every review comment gets the comment card's ⋯ menu (Edit in place, Quote reply, Copy link, Delete, each where
GitHub allows; owner, 2026-11-19). Base: `b7a10521`.

## Round 1 · agent brief: three variants

Asked: three shapes of a review thread for the owner to pick on the design, each drawn in the diff (open with the ⋯
menu, replying and editing in place, outdated, resolved) and on a pull request's thread. No existing component or
screen changed.

Round 2 settled the pick; the entries below were drawn and then removed or moved, nothing in them is left to build.

- [x] App · Code review (`CEDLB`): new amber frame `Variants · How a review thread looks` (`a2TAL`), its last child.
- [x] Variant A · One card, a head per comment (recommended): `CR149` (`pGNLu`), `CR150` (`b0jP4F`), `F32` (`llYPQ`).
- [x] Variant B · As the code thread on a pull request: `CR151` (`wpBQo`), `CR152` (`A0xTx`), `F33` (`uqo52`).
- [x] Variant C · A card per comment: `CR153` (`dob0U`), `CR154` (`NEZWA`), `F34` (`f2PgFe`).
- [x] Components · Review threads (`ofln3`), in the variants frame: shared `Thread / Reply field` (`tXuu2`,
  `· focused` `c4axB`), `Thread / Reply band` (`d8dHr`, `· focused` `DYYpu`, `· writing` `Xjhhs`),
  `Thread / Resolve band` (`W0ldZQ`); A's `Thread / Comment section` (`A3lZet`, `· pending` `e7cd7`, `· editing`
  `degCO`) and `Thread / Card` (`paBQo`, `· focused` `EYKRN`, `· replying` `JQ29D`, `· outdated` `NzvPm`,
  `· on a pull request` `gqX2i`); B's `Thread / Flat comment` (`P5b4sb`, `· hovered` `gVbpQ`, `· pending` `frBwF`,
  `· editing` `O3TEt`) and `Thread / Flat` (`o52wMq`, `· focused` `eSRVY`, `· replying` `GGKPS`, `· outdated`
  `NUvwn`, `· on a pull request` `MNkSV`); C's `Thread / Stack of cards` (`BaoDN`, `· focused` `eKySy`, `· replying`
  `wSeqy`, `· outdated` `XYVU6`, `· on a pull request` `Fb9WY`).
- [x] Canvas: the row of top-level frames from `App · Command menu` down moved 7214 px down, keeping 1200 px below the
  taller `App · Code review`.

Left for the owner's pick: C has no "Pending" pill (the narrow card has none); C's focus is a 2 px accent bar left of
the stack, as no one card holds the whole thread.

## Round 2 · owner's pick, agent brief

Asked: the owner picked Variant B (2026-11-19). Fold it into the real components so every screen with a review
thread changes, settle the variants.

Components (`Components · Code review`, `crvke` → `Thread parts`, `SSotp`):

- [x] Review / Comment (`IHFo8`): meta line (`y516VN`) full width, 20 px high, with hidden `Edited` (`C1OFHW`), a
  spacer (`GZVAJ`) and a hidden ⋯ `More` (`So5NZ`); new `Body` (`AdsFm`) holding the text (`o6hbQ`) and a hidden bold
  `Lead` (`ca6WN`); the text `$fg-2` → `$fg`. `· current` (`fNNF4`) and `· pending` (`znW1W`) inherit it.
- [x] Review / Comment · hovered (`p5QdYW`): new, the ⋯ shown.
- [x] Review / Comment · editing (`n2U14`): new, the comment's editor in place.
- [x] Review / Thread (`ce2EO`): `$bg-2` → `$bg`, clipped, padding 12/14 → 0, gap 12 → 0; `Head` (`XKVAM`) a band with
  a `$border` bottom edge, padding 9/14; new `Body` (`jHOqT`, gap 14, padding 12) holding the comments; the one-row
  `Reply row` (`q5hSO`) → `Reply band` (`ZzJy7`) and `Resolve band` (`v5HOc6`). `· outdated` (`Ypl9I`) inherits.
- [x] Review / Thread · focused (`M54IUE`): its Reply band `· focused` (`j2Jk9`): `R` shows only when focused.
- [x] Review / Thread · replying: `eS728` → `Bc2hQ` (in `AeXsY`), the editor in the Reply band (`pfV9R`).
- [x] Review / Thread · replying, tools folded: `r4Ect` → `N6qt3` (in `E3gaOM`), 490 px, the tools folded (`nQNFg`).
- [x] Activity / Code thread (`BGMhn`): body gap 10 → 14; the reply field (`CIpJY`) → `Thread / Reply field`
  (`KOQJ3`); its comments follow `Review / Comment`. `· replying` (`phPkk`), `· resolved` (`GlhsY`), `· outdated`
  (`Tc0aE`) inherit.
- [x] Thread bands (`p5ar1V`): new `Thread / Reply field` (`vnbLu`), `Thread / Reply band` (`FUkob`, `· focused`
  `bqocN`, `· writing` `OMVhL`), `Thread / Resolve band` (`AUF6R`).
- [x] `Review / Thread · resolved` (`oAPPV`): unchanged.

Screens:

- [x] CR74: the thread (`B3QDc` → `NSGDI`, `· replying`) holds the reply in its band; the separate `Gap` (`pHW0Q`) and
  `Comment box` (`c03aJZ`) removed. CR92 (`h3Uxe` → `LkOZF`), CR117 (`ChQ5X` → `I0fA5t`), CR118 (`UYwrs` → `UfmC2`)
  re-pointed to the new replying thread; `RHUdU`, `rW0Ci`, `rjGyc` (CR75, CR76, "Add to your draft…") onto the new
  bands.
- [x] New group header `Review threads` (`ncwzm`) and row (`CYNao`) where the variants were: `CR151 · A thread in the
  diff, open` (`wpBQo`), `CR152 · Replying, and a comment edited in place` (`A0xTx`), `F33 · The code thread on a pull
  request's thread` (`uqo52`), rebuilt from the real components.
- [x] Removed: the variants frame (`a2TAL`), `Components · Review threads` (`ofln3`) and every `Thread / …` component
  of round 1, CR149, CR150, F32, CR153, CR154, F34.
- [x] Canvas: the 25 frames from `App · Command menu` down moved 5636 px up, 1200 px below `App · Code review` again.
