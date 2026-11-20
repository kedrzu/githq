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

## Round 2a · agent brief

Asked (`.context/button-system-brief-2a.md`): the colour variables the code's destructive and light-surface buttons
use, and every button in App · Merging a pull request (`LLr2k`) and App · Stacked pull requests (`LIEPU`) drawn with
the family at its place's size and variant.

Changed: 63 instances of the old button components and 9 hand-drawn buttons became family instances. Each new
instance was inserted at the old one's index with its label, icon, key and visibility, then the old one deleted (its
id is gone). Keys that were another `Kbd …` were replaced in the new instance's `Key` slot, at the size's key height.
The merge panel's footers moved from 24 to 32 px; they size to content, so no container needed adjusting.

- [ ] Variables: new `$red-emphasis` `#DA3633`, `$on-emphasis` `#FFFFFF`, `$on-light` `#0D1117` (the code's
  `$color-red-emphasis`, `$color-on-emphasis`, `$color-on-light`).
- [ ] Button / sm|md|lg · destructive (`L9VJfE`, `f8sNbZ`, `Z7XjE`): fill `$red` → `$red-emphasis`; icon and label
  `#0D1117` → `$on-emphasis`; key `#0D111729` / `#0D111733` → no fill, stroke `#FFFFFF66`, glyph `$on-emphasis`
  (Kbd's `onDanger`).
- [ ] Button / sm|md|lg · primary (`fQMJo`, `PmKqy`, `sJgFa`) and · light (`qzu4v`, `XjdaU`, `e2B8m`): icon, label
  and key glyph `#0D1117` → `$on-light` (the key's translucent fill and stroke stay hex).
- [ ] Merge / Footer (`wKwA4`): `Wycr9` (`Button / icon, label, key`, 24) → `skz2I` (`Button / md · primary`,
  git-merge, ⌘↵). Its 15 instances' label, icon and name overrides moved to `skz2I` (iAsoE, sNsOZ, p8are, P58Gmw,
  i73Ehg, p1C1V, wpmNZ, hBwSa, H9TI6, pV2gT, bzDvR, XgatD, S87goL, fGk1F, KbXhK).
- [ ] Merge / Footer · stop earlier, checks (`hocRs`): `L2wMIW` → `Ooma6` (`Button / md · primary`); `fwL4L`'s
  "Rebase and merge all 3" moved to it.
- [ ] Merge / Band (`i7gsTn`): `Ihagy` (24) → `Jia9X` (`Button / md`, Open on GitHub, O); overrides of `fIOhx`,
  `ur7X9` ("#490 on GitHub"), `N76Wv` moved to it.
- [ ] App · Merging a pull request (`LLr2k`), 41 screen buttons:
  - merge panel footers' main action (Squash and merge, Enable auto-merge, Add to queue, Update branch, Mark ready
    for review, Squash and merge all 3): 24 px accent → `Button / md · primary`;
  - their neighbours (Jump the queue, was ghost; Take out of queue; Turn off auto-merge; Revert…, was ghost; Rebase
    stack on GitHub; Resolve on GitHub; Can't merge yet, was `md` light restyled) → `Button / md`, the disabled
    "Can't merge yet" keeping its `$fg-3` icon and `$fg-dim` label;
  - Bypass rules and merge (PM12a): 24 px red outline → `Button / md · danger`;
  - the panel's own action bar and its error states' actions (Open on GitHub, See the new commit, Request access on
    GitHub, Sign in again) → `Button / md`;
  - a check row's Re-run (ghost, ⇧E) → `Button / sm · ghost`; the Branch row's Update by rebase (was ghost),
    Delete branch and Restore branch → `Button / sm` (a row's inline control).
- [ ] App · Stacked pull requests (`LIEPU`), 18 screen buttons: the stack merge panel's footers as above (Squash and
  merge, Enable auto-merge for both and Link 3 into a stack, white labels before → `Button / md · primary`; Mark #102
  ready, was ghost, Rebase stack on GitHub, Take out of queue, Close, Go to that stack, Dissolve, the disabled
  Squash and merge / Link 3 into a stack / Can't merge yet → `Button / md`); Bypass rules and merge #1203 →
  `Button / md · danger`; the Chain offer's Link as a stack… → `Button / md`.
- [ ] Toasts on PM34 (`iufWy`), PM35 (`eUSa0`), SP80 (`wGo8k`): the second action, replaced in the instance by
  `Button / icon, label, no key`, → `Button / sm` (Revert; Open on GitHub). The toast's own actions are the Toast
  component's, App · Toasts' round.
- [ ] SP5's hand-drawn merge card (`FGLBP`, 512 wide in the panel): Merge (`aXtZI`, white on accent, 26 px) →
  `Button / md · primary` (⇧M); Open on GitHub (`w8u1aL`) → `Button / md` (O); Review files (`Zcc1i`, was a ghost
  text) → `Button / md` (⇧O). Wide enough to keep the icons.
- [ ] Hand-drawn project headers: PM35's Display (`g0vhmr`, 23 px) → `Button / sm · outline` (the code's); SP26's
  icon-only Display (`d3huXr`) and Reset view (`BcarU`) → `Icon button / sm`.
- [ ] A stack screen's panel toolbar (`YPRJ7`): hand-drawn Open on GitHub (`rbUvD`) and Close (`CTTe1`) →
  `Icon button / sm`.

Left as they are: the merge method's segmented choice (`Method …`) and PM35's "Changed here · Reset" chip are not
buttons under the guideline; the item panel's merge card is `Item / PR merge` (App · Components), a later round.
