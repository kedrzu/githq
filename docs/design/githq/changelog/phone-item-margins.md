# Phone item margins

On a phone every pixel of width counts, so an opened issue's or pull request's content sits as far from the screen's
sides as the toolbars do. The top bar, the command line and its dock sit 12 px from the sides; the item's content now
does too. Base: `2520e616`.

## Round 1 · implementation

Forced by: the item's content sat 40 px from a phone's sides in the app, 16 in the design, the toolbars 12.

Changed in the components that own the inset, so every item screen in `App · Mobile` follows (`Phone / Item / …`
`Z50g0`, `UXIHb`, `PWGSV`, `qZhtg`, `j4OTf`, `EkP8V`, `e1palS`, `aUYA5`, `GSjJM`, `D4CI1`). The top padding above the
reference was 14 already, under 16, so it stays.

- [x] Phone / Item head (`zG5m0`): side inset 16 → 12.
- [x] Phone / Summary · pull request · as on the desktop (`WNkfa`): side inset 16 → 12.
- [x] Phone / Summary · issue · as on the desktop (`YrWzg`): side inset 16 → 12.
- [x] Phone / Thread (`ShZ5Q`): side inset 16 → 12.
- [x] Phone / Thread · pull request (`S2bNY`): side inset 16 → 12.
- [x] Phone / Thread · eighty events (`SL9Ha`): side inset 16 → 12.
- [x] Phone / Thread · loading (`CBVcb`): side inset 16 → 12.
- [x] Phone / Thread · failed (`TZXjq`): side inset 16 → 12.
- [x] Phone / Thread · empty (`OAc3d`): side inset 16 → 12.
- [x] Phone / Thread · reviews (`CySKi`): side inset 16 → 12.
- [x] Phone / Stack strip (`yjxbJ`): left inset 16 → 12, so the strip's icon lines up with the reference above it.

Left at more than 12 px while the toolbars sit at 12, not changed in this round:

- Phone / Filter strip (`VtYLv`): chips 16 from the sides (padding `[10,16,6,16]`), with the list's group headers.
- First sign-in, `MB135`–`MB138`, `MB163`, `MB164`: the setup bar 20, the intro 20, the search, segments, rows and
  footer 16.
- Settings, `MB146`–`MB161`, `MB168`, `MB172`, `MB246`: section titles, rows and notes 16; `MB162`'s empty state 24.
- New issue form, `MB194`–`MB196`, `MB210`–`MB214`, `MB216`, `MB268`, `MB269`: fields, details and body 16.
- Empty screens, `MB96`, `MB208`, `MB209`: centred content in a 24 px inset.
