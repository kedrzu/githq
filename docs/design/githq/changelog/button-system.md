# Button system

Buttons on one scale and one set of variants, as `docs/design/githq/buttons.md` (D45) says: 24 / 32 / 40 px (`sm`,
`md`, `lg`) by what a place is for, icon-only buttons 24 and 32, one meaning per variant. The twelve button components
of App · Components and Components · Activity become one `Button / …` family, and every screen's buttons move onto it.
Base: `aed97b67`.

## Round 1 · agent brief

Asked (`.context/button-system-brief-1.md`): the `Button / …` family in App · Components, the old button components
turned into instances of it with their ids kept, and the `Buttons — guideline` sheet.

Changed: the family and the sheet are new. Pen can't keep a node's id when a frame becomes an instance, can't
retarget an instance's `ref`, and drops the overrides that point into a replaced node. Making the old components
instances would have given about 160 screen instances new ids and re-applied about 480 overrides on 168 others. So
the twelve old components keep their ids and child ids and were restyled in place to the family's measures for their
size and variant; they become instances (or are swapped for the family) when the screens move onto it. Screen
instances that overrode padding, gap, radius, font size or weight, icon size or key height now override them with
the scale's values (226 updates, no ids changed). Pen doesn't count a stroke in layout, so the family's padding
includes the 1 px stroke: `sm` 4 / 8, `md` 7 / 12, `lg` 11 / 16 (with key: end 4, 7, 11).

- [ ] Buttons and chips (`UnhnK`): vertical; rows `Family · sm` (`o3CD09`), `Family · md` (`F92p0`), `Family · lg`
  (`QzmUt`), `Icon and split buttons` (`py5Oa`), `Buttons in use and chips` (`xZUlj`, the earlier children moved in).
- [ ] New `Button / sm` (`lLbwO`), `Button / md` (`MHAI5`), `Button / lg` (`r7YsD`): the secondary variant (`$bg-3`,
  stroke `$border-2`, label `$fg`); Icon (lucide, hidden), Label (Inter 500, 12 / 16, 13 / 18, 14 / 18), Key (`Kbd`,
  hidden, 16 / 18 / 18 tall); radius 6 / 7 / 7, gap 6 / 7 / 7. The icon takes the label's colour.
- [ ] New variants, instances of their size's base: `· primary` (`fQMJo`, `PmKqy`, `sJgFa`: `$accent`, label
  `#0D1117`, key `#0D111729` / `#0D111733`), `· ghost` (`kl53W`, `Or7Hp`, `U7X06`: no fill, `$fg-2`), `· outline`
  (`oHOZZ`, `fOizr`, `j99Zd`: stroke `$border`, `$fg-2`), `· danger` (`GbVPY`, `M4s1se`, `HJ2g1`: `#F851490F`, stroke
  `#F8514973`, `$red`), `· destructive` (`L9VJfE`, `f8sNbZ`, `Z7XjE`: `$red`, label `#0D1117`), `· light` (`qzu4v`,
  `XjdaU`, `e2B8m`: `$fg`, label `#0D1117`). The file has no `$on-light`, `$on-emphasis`, `$red-emphasis` or light
  button variable; these are the values the existing buttons use for those roles.
- [ ] New `Icon button / sm` (`GRpic`, 24 × 24, glyph 14, radius 5) and `Icon button / md` (`F3xkp0`, 32 × 32, glyph
  16, radius 7), icon `$fg-2`.
- [ ] New `Split button / md` (`RmbQl`): a `Button / md` (`qnCtH`, "Close issue") on the split's own `$bg-3` /
  `$border-2` frame, a 1 × 16 `$border-2` rule and a 14 px chevron segment; 32 tall.
- [ ] Button / icon, label, key (`n73Aps`) → `sm` secondary with icon and key: padding 4 4 4 8, gap 6, radius 6,
  icon 14 `$fg` (was `$fg-2`), label 12 / 16, key 16 tall (was 4 4 4 9, gap 7, radius 7, key 15).
- [ ] Button / icon, label, no key (`m1uQkH`): padding 4 9 → 4 8.
- [ ] Button / label, key (`JOjbe`) → `sm` secondary with key, as `n73Aps`. Button / label, no key (`Dhiuj`): padding
  4 9 → 4 8.
- [ ] Button / icon, label (`EoODS`) → `md` light: padding 7 12, gap 7, radius 7, transparent 1 px stroke, icon 16
  (was 14), label 13 / 18.
- [ ] Button / label (`syf0m`) → `md` secondary: padding 7 12, label 13 / 18.
- [ ] Button / label, icon key (`vAXUD`) → `sm` ghost with key: transparent fill and stroke, padding 4 4 4 8, radius
  6, label 12 / 16 (was 12.5), key 16 tall.
- [ ] Button / small, outline (`gQ61z`) → `sm` outline: stroke `$border-2` → `$border`, padding 3 9 → 4 8, label
  12 / 16.
- [ ] Button / icon (`HtcJe`) → icon button `sm`: 24 × 24 by padding 5, radius 6 → 5 (was 30 × 22).
- [ ] Button / medium (`TH5d7`) → `md` secondary with icon and key: padding 5 8 5 10 → 7 7 7 12, gap 6 → 7, radius
  6 → 7, icon 13 → 16 `$fg`, label 12.5 → 13 / 18, key 18 tall.
- [ ] Button / medium · primary (`t0PlX5`): stroke `$accent` → transparent, icon `#0D1117`.
- [ ] Button / medium · menu (`L4s15U`) → the split's measures: padding 7 8 7 12, gap 7, radius 7, icon 16, label 13,
  key 18, rule 1 × 16, chevron 14.
- [ ] Instances of the twelve across the file: padding, gap, radius, font size and weight, icon size and key height
  overrides set to the scale's values for their component (merge footers' 5 8 5 10 / 12.5 / 600 included).
- [ ] App · Components → Components (`x7TAdR`): new row `Atoms and guideline` (`XK6l1`) holding Atoms (`U5qIGb`) and
  the new sheet `Buttons — guideline` (`Afd8j`): sizes, variants by size with their meanings, icon and split
  buttons, the rules, and two examples (a composer's footer, a list's toolbar).
