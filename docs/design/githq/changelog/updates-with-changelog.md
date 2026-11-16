# The changelog in Updates

Settings' Changelog section joins Updates: the changelog becomes a block under the version and the update stream, and
the sections column ends with Updates (desktop releases D20). Base: `56334c2d`.

## Round 1 · agent brief

Asked: the Changelog block inside `Updates / Pane`, the Updates screens showing it, U41–U48 as Updates screens, the
sections column without Changelog, the notes that pointed at the section. Changed: one new component, the pane and every
Updates screen; the Changelog pane is gone.

- [x] Components · Updates: new `Changelog / Block` (`jSJW3`): its head (title, `↑↓ Move`, `Space Open or close`,
  All releases on GitHub `O`, following the title) and the folds, built from the `Changelog / …` components.
- [x] Updates / Pane (`Q7XjaK`): the block (`d4WWO`) under Update stream, 28 px apart; the pane's height fits its
  content and clips, so on a 900 px screen the block runs past the bottom.
- [x] Changelog / Pane (`t5HjX`): removed, with its instances in U41–U48.
- [x] U3–U19, U39: the block in the state that screen implies: the Stable fold open on Stable screens, the Development
  fold and All commits on a Development build, Running on 0.1.2 in U7, U8 and U39; offline in U9 and U16, failure
  in U10, no Stable yet in U11 and U17.
- [x] U41–U48: Updates screens (Updates selected, its header, the version and stream of U3, U4 for U43–U44, U11 for
  U45) with the changelog's state below; frames, slots and captions renamed `U41 · Settings · Updates · Changelog,
      Stable` and so on; no GitHub button offline (U47) or with no versions (U45).
- [x] Settings / Sections column · desktop (`Mxhs1`): the Changelog row (`XRz95`) off; Updates last, key `8`.
- [x] Group header "What changed" (`ODTOS`): title `M7RDj` "The changelog, in Updates", note `I7SYW` rewritten.
- [x] Notes and captions that named the section (`Re5vG`, `jU4Gb`, `KWA3G`, `p3P05`, `W6Utpu`, `EC8Sr`): What changed
  opens Updates; no Settings: Changelog command.

Built in this PR, except one difference that predates it: the code offers All releases on GitHub with no versions yet
(U45), the design doesn't.
