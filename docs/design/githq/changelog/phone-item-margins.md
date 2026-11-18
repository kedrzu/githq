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

The owner kept the phone's 16 px for the other phone screens (filter strip, first sign-in, settings, the new issue
form, empty screens); round 2 brings the ones that sat wider than that to 16.

## Round 2 · implementation

Asked: the owner kept the phone's 16 px for everything but the item; the design's wider insets brought to it.

The `Empty / Note · …` components are shared with desktop screens, so the inset changed in the phone screens' own
frames that hold them. The iOS status strip and keyboard and the `More` rows' 52 px indent (aligned with the rows'
names) stay.

- [x] Phone / Setup bar (`H329p`): left inset 20 → 16 (`MB135`–`MB138`, `MB163`, `MB164`).
- [x] MB135 · Intro (`WvRYo`): side inset 20 → 16.
- [x] MB138 · Intro (`E5KES`): side inset 20 → 16.
- [x] MB138 · Nothing to pick (`dIG5L`): side inset 20 → 16.
- [x] MB96 · Centre (`YWPCh`): side inset 24 → 16.
- [x] MB208 · Pane (`n4YW6N`): side inset 24 → 16.
- [x] MB209 · Pane (`Ozbfg`): side inset 24 → 16.
- [x] MB162 · Content (`K5lPz`): side inset 24 → 16.
- [x] Phone / Sheet / Private data hidden (`MPx50`): head and body side inset 20 → 16, as the other phone sheets
  (`MB137`).
