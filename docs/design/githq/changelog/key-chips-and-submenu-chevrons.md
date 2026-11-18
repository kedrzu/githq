# Key chips and submenu chevrons

A shortcut with a modifier is one key chip holding every glyph (`⇧O`, `⌘K`, `⌘⇧C`, `⇧↵`), not one chip per key; plain
keys, sequences (`G` `P`) and alternatives (`J` `K`, `↑` `↓`) stay separate chips. A command-menu row that opens a
deeper level shows its `›` right after its name, before any dim detail, as the context menu's submenu entries already
did; the row's far right keeps only the key chip, count, ↗ and check. The phone's bottom-sheet menus keep the chevron
at the row's end (MB109). Base: `f11264f1`.

## Round 1 · implementation

Asked (`.context/key-chips-brief.md`, not committed): the app on this branch already shows both; bring the design in
line. Changed: one new key component, 19 hand-drawn chip pairs and triples merged, the command-menu row component and
every hand-drawn command-menu row with a chevron, the docs shortcut table. The context and item menus' submenu entries
already had the chevron after the name and are unchanged.

Moving the label and chevron of `Command / Result` into a `Title` frame dropped the instances' overrides on them; they
were set again on every instance (the label's text and colour, the chevron's visibility).

- [x] Kbd / two icons + key (`CSqgu`): new, an instance of `Kbd / three icons` (`T24lwV`) whose third icon is a mono
  text key; draws `⌘⇧C`.
- [x] Command / Result (`k3mGr`): the modifier chip `Kbd modifier` (`VijC9`, `Kbd / icon`) → `Kbd with modifier`
  (`tKPtn`, `Kbd / icon + key`), hidden by default, so a combination is one chip; `Label` and the chevron moved
  into a new `Title` frame (`pLPEd`, gap 4) after the icon, so the chevron follows the name.
- [x] Command / Menu · search repositories instance in `E6` (`F1thkx`): "Show as board" `⇧` `V` → one `Kbd ⇧V` chip
  (`tbKqD/tKPtn`); label and chevron overrides set again.
- [x] Instances of `Command / Result` in `Components · Command menu` (`B7AwZ`), `Desktop · Updates` and
  `App · Workflows`: label and chevron overrides set again; the chevron now sits after the name.
- [x] App · Command menu (`D27jC`), `E1` (`SbPDO`): Open full screen `⇧` `↵` → `Kbd ⇧↵` (`D2DLrB`); Copy link `⌘` `⇧`
  `C` → `Kbd ⌘⇧C` (`jBBbI`); Show as board `⇧` `V` → `Kbd ⇧V` (`xHCo1`).
- [x] App · Command menu (`D27jC`), `E1`–`E4`: the chevron moved from the row's end into a `Title` frame after the name
  in Set status… (`ohKIj`, `an23x`), Set priority… (`Vgbjl`), Set iteration… (`m9TnHK`), Assign to… (`R3weHd`,
  `bCUmv`), Add or remove labels… (`qM9Zg`), Add labels… (`s0n3H`), Close issue… (`b53Plc`), Close 3 issues…
  (`Whw5l`), Group by… (`KukBY`), Add to another project… (`NvMj0`), Filter: Area is Platform (`zidjc`).
- [x] Landing — githq.dev and its mobile frame: the command-menu row Filter: Area is Platform (`Qu42M`, `shyoq`),
  chevron after the name.
- [x] App · Context menu (`uWch5`): Open full screen (`Ev5gr`) → `Kbd ⇧↵` (`pR6Mi`); Copy link / Copy links (`QWeL5`,
  `kyyuV`, `A7DZy`, `SeVwl`) → `Kbd ⌘⇧C` (`RgYqH`, `ohAMJ`, `rQGiB`, `VHlMh`); Review files on GitHub (`zRKbc`,
  `mF4eG`) → `Kbd ⇧O` (`JDvcN`, `stOsK`); Request review (`CvauO`) → `Kbd ⇧R` (`PJ3v2`); Merge (`ZiiSh`) →
  `Kbd ⇧M` (`e8dMxp`).
- [x] App · Item menu (`xgYRz`): Copy link (`yNr2B`, `DO0vH`) → `Kbd ⌘⇧C` (`psrc3`, `UresH`); Review files on GitHub
  (`URrZF`) → `Kbd ⇧O` (`B7uTwi`); Request review (`aAPYQ`) → `Kbd ⇧R` (`TWHgh`); Merge (`v92ga`) → `Kbd ⇧M`
  (`fK1cO`); footers (`s1cGY`, `u6Fn3`) `⌘` `.` → `Kbd ⌘.` (`pcssU`, `ZT7vU`).
- [x] Docs / Shortcut row (`CAswD`): keys `⌘` `K` → one chip `⌘K`; its instances Open the command menu (`d42YHX`),
  Close the item (`hmT2s`) and Open on github.com (`rDM5X`) → one chip each, `⌘K`, `⇧C`, `⌘⇧O`.
