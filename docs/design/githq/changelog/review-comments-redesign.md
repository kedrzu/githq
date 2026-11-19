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

- [ ] App · Code review (`CEDLB`): new amber frame `Variants · How a review thread looks` (`a2TAL`), its last child.
- [ ] Variant A · One card, a head per comment (recommended): `CR149` (`pGNLu`), `CR150` (`b0jP4F`), `F32` (`llYPQ`).
- [ ] Variant B · As the code thread on a pull request: `CR151` (`wpBQo`), `CR152` (`A0xTx`), `F33` (`uqo52`).
- [ ] Variant C · A card per comment: `CR153` (`dob0U`), `CR154` (`NEZWA`), `F34` (`f2PgFe`).
- [ ] Components · Review threads (`ofln3`), in the variants frame: shared `Thread / Reply field` (`tXuu2`,
  `· focused` `c4axB`), `Thread / Reply band` (`d8dHr`, `· focused` `DYYpu`, `· writing` `Xjhhs`),
  `Thread / Resolve band` (`W0ldZQ`); A's `Thread / Comment section` (`A3lZet`, `· pending` `e7cd7`, `· editing`
  `degCO`) and `Thread / Card` (`paBQo`, `· focused` `EYKRN`, `· replying` `JQ29D`, `· outdated` `NzvPm`,
  `· on a pull request` `gqX2i`); B's `Thread / Flat comment` (`P5b4sb`, `· hovered` `gVbpQ`, `· pending` `frBwF`,
  `· editing` `O3TEt`) and `Thread / Flat` (`o52wMq`, `· focused` `eSRVY`, `· replying` `GGKPS`, `· outdated`
  `NUvwn`, `· on a pull request` `MNkSV`); C's `Thread / Stack of cards` (`BaoDN`, `· focused` `eKySy`, `· replying`
  `wSeqy`, `· outdated` `XYVU6`, `· on a pull request` `Fb9WY`).
- [ ] Canvas: the row of top-level frames from `App · Command menu` down moved 7214 px down, keeping 1200 px below the
  taller `App · Code review`.

Left for the owner's pick: C has no "Pending" pill (the narrow card has none); C's focus is a 2 px accent bar left of
the stack, as no one card holds the whole thread.
