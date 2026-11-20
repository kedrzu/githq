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

## Round 2b · agent brief

Asked (`.context/button-system-brief-2b.md`): every button in App · Pull request (`XN8vf`) and App · Code review
(`CEDLB`), and the components inside them, drawn with the family at its place's size and variant.

Changed: 24 instances of the old button components and 13 hand-drawn buttons became family instances, inserted at
the old one's index with its label, icon, key and visibility, then the old one deleted (its id is gone). Keys added in
this round are text in the family's own `Key` slot (`⇧S`, `J`, `V`, `Esc`) where no `Replace` was needed; a `Replace`
of a key slot inside `Review / Pending toolbar` failed. App · Pull request's own buttons are all in Components ·
Activity, and four of those components can't be edited yet (below).

- [ ] Diff / File note · binary (`aPT6Y`): `weipG` (`gQ61z`, 24) → `qxna2` (`Button / md`, Open on GitHub).
- [ ] Thread / Resolve band (`AUF6R`): `nbygz` (`TH5d7`) → `KQyPy` (`Button / md`, circle-check `$green`, Resolve
  thread).
- [ ] Activity / Code thread (`BGMhn`): `j0VETI` (`TH5d7`) → `uxXso` (`Button / md`, circle-check `$green`, Resolve
  thread); `Activity / Code thread · resolved` (`GlhsY`)'s rotate-ccw / Unresolve overrides moved to it.
- [ ] Review / Pending toolbar (`OCfqo`), a bar inside a pane, `sm`: Dismiss `DdloZ` → `h0PeP` (`Button / sm`,
  hidden); Discard review `wqUGr` → `hEcIf` (`Button / sm`); hand-drawn amber Submit review `p7BfB7` → `ncths`
  (`Button / sm · primary`, fill `$amber` as the bar's state colour, key `⇧S`). Overrides moved: `zWVql` (Edit review;
  Submit `$red`, Try again, key hidden), `MdLTM` (Discard and Submit hidden), `YOegj` and `elbyz` (Dismiss shown;
  elbyz's Submit hidden).
- [ ] Review / Find bar (`iWL1w`): Previous / Next match and Close (`HtcJe`) → `g43EbB`, `C8NhuZ`, `mpkrO`
  (`Icon button / sm`); the 0.4 opacity of `xV6g3`, `jjhPD`, `IxL6A` moved to them.
- [ ] Review / Selection bar (`YiQJ9`): hand-drawn white Mark viewed `jytpY` → `Wih4M` (`Button / sm · primary`, V).
- [ ] Review / Toolbar (`Tt0Pa`): hand-drawn Back `xrlyH` (22 × 22) → `R7eRu`, Open on GitHub `GIewl` (21 × 21) →
  `R8wG4m` (`Icon button / sm`).
- [ ] Review / Conversation (`sf3K6`): Show older reviews `gRhb4` (`gQ61z`, hidden) → `Pl6RC` (`Button / sm`, hidden);
  `OG350`'s "shown" override moved to it.
- [ ] Submodule / Pointers line (`hpMBi`): Open comparison on GitHub `s3uQel` (`gQ61z`) → `pECZl` (`Button / sm`, a
  row's inline control).
- [ ] App · Code review (`CEDLB`), screens:
  - CR39 dialog footer (`NmIQ5`): Cancel `dP968` (`JOjbe`, focused `$accent` stroke) → `lHbdQ` (`Button / md`, Esc,
    stroke kept); hand-drawn red Discard 3 comments `CvDk3` → `HkLFQ` (`Button / md · destructive`, ⌘↵);
  - CR62 Pushed since bar (`UImR9`): Show only these 3 `nv3QY` (`gQ61z`) → `QZF5i` (`Button / sm`);
  - All viewed actions (`DLfdl`, CR86 `kmkBd`): white Submit review `K9DNxw`, `Zwez9` → `S4uHh`, `bpOgK`
    (`Button / md · primary`, ⇧S); Next: #1203 `edd1X`, `U0dDU` (`JOjbe`) → `XDeo7`, `Hc3sa` (`Button / md`, J); Show
    viewed files `uwTRH` (`Dhiuj`) → `NV7Wv` (`Button / md`);
  - file notes (`apjNE`, `C0arQ6`, `ZkFmT`): Try again `E3hejD`, Open on GitHub `UWSZL`, `DPfl1`, `jcJpZ` (`gQ61z`,
    24) → `vSTqP`, `qyXYL`, `eGdOD`, `xId51` (`Button / md`);
  - CR75 / CR85 dialog footers: white Submit review `nXYSq` → `GQsRr` (`Button / md · primary`, ⌘↵); disabled Write a
    comment first `NxRc3` → `LP4OJ` (`Button / md`, label `$fg-dim`);
  - Toast row's toast `q7YFQ` → `e9RRO` (re-inserted with its overrides; its replaced Dismiss, `Dhiuj`, →
    `Button / sm`). The toast's own Restore is the Toast component's, round 2c's.
- [ ] Parked to edit Pending toolbar and Code thread (they replace slots depending on both): App · Pull request's two
  `PR view (panel)` instances `bMvh6` → `b6sPUF` (F9) and `XyA3Q` → `J1a6U`, deleted and re-inserted with the same
  data; 40 ids inside their replacement subtrees were regenerated (nothing pointed at them).
- [ ] Repair, not a design change: one failed batch (the key `Replace` in Pending toolbar) left self-referencing
  override copies on 81 instances. Each was re-inserted with the same data minus those entries, so it has a new id:
  77 `Review / Conversation` instances in App · Code review (`m6wYI` → `WBdO7` and 76 more), one each in Landing —
  githq.dev and Landing — githq.dev (mobile), a `Phone / Thread · reviews` instance in App · Mobile (→ `oD9lG`), and
  `dVt5j` → `KcYQq` (`Phone / Thread · eighty events`) inside `Phone / Item / Pull request · long thread` (`EkP8V`).

Left as they are:

- Activity / Comment (`WHy4W`: Discard `AQsyM`, Retry `SA15Q`), Activity / Editor (`OXAXr`: Close `wYaxO`, Comment
  `gAIL0`), Activity / Composer · issue (`AljH1`, a slot replaced by `L4s15U`), Review / New comment (`SAmev`, an
  editor footer replaced with `TH5d7`/`t0PlX5`): Phone variants in App · Mobile replace slots depending on them, so
  Pen fails any edit (round-2 notes); needs the owner's call or a Pen fix.
- Activity / Thread · failed (`V75cQv`: Try again `Z7ltJ`, Open on GitHub `G0C6RH`): its holder `nG2dv` is in App ·
  My work, outside this round.
- The pull request's merge card is `Item / PR merge` (`BioKQ`) in App · Components, outside this round (its holder
  `y0oJ22` is in App · My work).
- Not buttons under the guideline: Write / Preview tabs, the file list's filter field, a diff header's Viewed toggle,
  the segmented Split / Panels controls, the conversation's Reply field. Review / Toolbar's View options (a current
  value with a chevron) stays drawn: the family has no trailing chevron and its overrides live in Landing frames too.

## Round 2c · agent brief

Asked (`.context/button-system-brief-2c.md`): every button in App · Workflows (`IEyTW`), App · Toasts (`Sz7Bf`), App ·
Loading and empty states (`O6Vuj8`), Desktop · Updates (`ohwJa`) and Desktop · Commits (`Ri8IR`), and the components
inside them, drawn with the family at its place's size and variant.

Changed: 21 instances of the old button components and 9 hand-drawn buttons became family instances, inserted at the
old one's index with its label, icon, key and visibility, then the old one deleted (its id is gone). 351 overrides
pointing into the replaced component slots, from instances across the file (App · Repository, States, Merging,
Stacked pull requests, Settings, Code review and the five frames), were moved to the new slots (405 updates); slot
replacements by `Button / icon, label, no key`, `Button / label, no key` or `Button / sm` became plain overrides on
the new slot. Seven `padding` overrides on old buttons were dropped (a family member keeps its size).

- [ ] Toast (`E6hAh`), `sm` secondary: Action `e3gZq` (`n73Aps`) → `MxyH9` (`Button / sm`, ⌥A, icon hidden); Second
  action `McVDN` → `yvYm9` (`Button / sm`, hidden, Open on GitHub, O); Dismiss `ehllm` (`JOjbe`) → `whFeT`
  (`Button / sm`, Esc). Instances that replaced these slots now override them: App · Toasts `a7wQG`, `wVzrA`,
  `j7ais`, `cizSJ`, `a5rP6K`, `PMZvm`, `Q9Duu`; App · Workflows `ZLEbN`; App · Merging `iufWy`, `eUSa0`; App · Stacked
  `wGo8k`; App · Code review `e9RRO`.
- [ ] Toast / Issue created (`SnRpU`, its Actions replaced by a frame of old buttons) → re-created as `fcrwM`
  (instance of Toast; Create another with plus, Open, Dismiss hidden, no keys). Its one instance in App · Creating an
  issue, `Tbwkt`, → `vsW7Z`.
- [ ] Workflow alerts / Pattern row (`qzyaU`): Edit `Q6OxIK`, Remove `M7zFfT` (`HtcJe`) → `DTrHF`, `TKdeB`
  (`Icon button / sm`).
- [ ] Workflow / Item head (`oZJKi`): Run workflow `Z77eN` (`TH5d7`, 32) → `M2atbC` (`Button / sm`, play, key hidden),
  as the code's `WorkflowView`.
- [ ] Workflow / Alerts bar (`tnY9k`): hand-drawn Alert settings `ZKENq` → `HytXE` (`Button / sm · ghost`, P).
- [ ] Clone / Dialog (`IyxDk`), dialog footer `md`: Close `YaYqb` (`JOjbe`, transparent) → `NYP4h` (`Button / md`,
  Esc); Action `XfFRD` → `OAmWH` (`Button / md · primary`, ↵).
- [ ] Updates / Confirm switch (`wwNgw`): Cancel `EXkFn` → `ALmK7` (`Button / md`, Esc); Switch to Stable `BnpkM` →
  `qnKT9` (`Button / md · primary`, ↵).
- [ ] Updates / Status (`R6xmpT`), a settings block: Restart `DZofS` (`JOjbe`, hidden) → `NBbjt` (`Button / md`, R,
  hidden).
- [ ] Updates / Pane (`Q7XjaK`): Check for updates `OS1jO` (`n73Aps`, 24) → `LiDIU` (`Button / md`, refresh-cw, U).
- [ ] Changelog / Block (`jSJW3`), a section's header: All releases on GitHub `cGRSZ` → `l6P9xe` (`Button / sm`,
  arrow-up-right, O).
- [ ] Empty / Note · screen (`hk0U0`), an empty state's actions `md`: Action 1–3 `JklzQ`, `NeWyo`, `R89uW` (`n73Aps`,
  24) → `gLnio`, `YhFxC`, `BIp9N` (`Button / md`; Try again R, Open on GitHub O, Clear filter X). Its variants
  (`p8xfZR`) and 30 instances carry their overrides on the new ids.
- [ ] Empty / Note · group (`LrGld`) and Empty / Note · column (`oVaNJ`): Clear filter `g1TjU`, `uZjiG` (`gQ61z`,
  outline 24) → `bFMaQ`, `u84sW` (`Button / md`, hidden); `ivSpa`, `yTnl1` show them.
- [ ] Parked to edit the components above (they replace slots with a Note instance): Desktop · Updates' `Updates pane`
  instances `bIVKd` → `KUQtv`, `CJ804` → `oVHV1`, `E893tA` → `hE6pC`, `U5BgwW` → `FIeWW`, `VxMVc` → `VSLhx`, `nzFop` →
  `QhGGJ`, `wuqKN` → `uk8AW`, `xSekA` → `AtK1k`, `SPFmZ` → `S8jqT`; App · Loading and empty states' `Column` `bqIyV` →
  `QBz9Q`, `C7ZoA` → `RgDkL`, `w2W2PC` → `ubbfL` and `Project pane` `oESiA` → `Ueckc`, `I4ehX` → `sLohV`; deleted and
  re-inserted with the same data, overrides into the old slots moved. Ids inside their replacement subtrees were
  regenerated (one, `ZwtfQ` → `zi88q`, reported; nothing pointed at them).
- [ ] App · Workflows, screens: W37's command menu footer Run `sAnyn` (`vAXUD`) → `R2lLYu` (`Button / sm · ghost`,
  ⌘↵); W36's header (`V2SEXH`) hand-drawn Filter, Group: Milestone, Display → `CthBi`, `HzsM6`, `bsX59`
  (`Button / sm · outline`, as the code's `ListToolbarControl` and `ListDisplayOptions`), github → `wSn8z`
  (`Icon button / sm`).
- [ ] App · Loading and empty states, screens: ES25's Try again `iGfZV`, Open on GitHub `HI1M1` (`n73Aps`) → `eIAHU`,
  `RyipF` (`Button / md`); ES29's header (`d0zuo`) Filter, Group: Issue type, Display → `LLpgC`, `B5oiHD`, `xpvIN`
  (`Button / sm · outline`).
- [ ] Desktop · Commits: six `Repository / Header · Commits` instances whose Right part replacement held an Open on
  GitHub `HtcJe` (`mnvEg`, `jNTI7`, `b3sV1`, `hSdJL`, `jxy90`, `CTTeE`) → re-inserted as `RugG5`, `JhTlL`, `iraPZ`,
  `lQMjy`, `O3zDS`, `CKidW` with `Icon button / sm`.

Left as they are:

- Update / Status bar (`SoI9D`): Restart and Later are the status bar's own 16 px segment buttons (the code's
  `UpdateSegment` draws them outside `Button`); the bar doesn't grow for a button.
- Toast's Close (`eE6zX`): the countdown ring around the x is its own control, not an icon button.
- Workflow / Group control (`Bwra9`, `oAVxG`) is a `Chip`; the code draws it as `Button` `sm` outline. Moving it means
  re-pointing a chip component, a later round.
- Not buttons under the guideline: the Projects bar's project pills, the refs' filter chips, Search log fields, Only
  matches toggle, the Layout switch.

## Round 2d · agent brief

Asked (`.context/button-system-brief-2d.md`): every button in App · Settings (`i3VkT`), App · First sign-in and
choosing what to track (`Zk4sa`), App · Creating an issue (`gvCqI`), App · Repository (`N1wdc`), App · Project
(`JCfIb`), App · Command menu (`D27jC`), App · Repository and project menu (`pgCGV`), App · States (`epLfx`),
Desktop · Sign in with a device code (`rV6qN`) and the non-phone parts of App · Mobile (`jy6bO`), and the components
inside them, drawn with the family at its place's size and variant.

Changed: 48 instances of the old button components and 41 hand-drawn buttons became family instances, inserted at the
old one's index with its label, icon, key and visibility, then the old one deleted (its id is gone). Pen drops the
overrides that point into a deleted node, so the 27 overrides other instances held on the replaced component slots
(all in App · Settings and App · Repository) were re-applied on the new ids. Sizes and variants follow the code where
it already draws the place (`tracking/*.vue`, `NewIssueDialog.vue`, `NewIssueFields.vue`, `RepositoryView.vue`). No
container needed adjusting: everything that grew sizes to its content, and the tracked rows keep their 36 px.

- [ ] Saving / stopped (`tJi7t`), an error block's actions `md`: Try again `O1thhH` (`n73Aps`, 24) → `CZHRd`
  (`Button / md`, refresh-cw, R); Open on GitHub `BTrLZ` (`EoODS`) → `UpdIZ` (`Button / md`, arrow-up-right). Overrides
  moved: `o5Eic`, `VknmQ` (hidden), `U4V7X`, `meKNI`, `r5nuU2`, `pzXvJ` (labels).
- [ ] Track / Pending changes (`j5sdqa`), a settings bar `md`: Discard `BDkyJ` (`JOjbe`, 24) → `P8R5Rk` (`Button / md`,
  Esc); Save 2 changes `VynTp` (`EoODS`, light) → `E4TMJn` (`Button / md · primary`, check).
- [ ] Settings / Tracked repository row (`CqvD4`) and Settings / Tracked project row (`L5sxR`), a row's inline control
  `sm`: Untrack `Fn248`, `tV4jo` (`JOjbe`, hidden) → `uU0H3`, `gD3Sf` (`Button / sm`, ⌫, hidden), as the code's
  `TrackedRow`; `Dht0d`, `jbKD6` show them.
- [ ] Settings / Owner group (`r7z5p0`): Track more `KSeXE` (`gQ61z`) → `h1thAB` (`Button / sm · outline`, as the
  choosers' group actions); visibility of `enu26`, `U4aLH`, `ZbsxI`, `g7ifnS`, `lv6Bi` moved.
- [ ] Settings / Tracked list head (`QpXtY`), a settings block `md`: Track repositories `a77QJ7` (`n73Aps`, 24) →
  `cmMXQ` (`Button / md`, plus, A), as the code's `TrackedListHead`; `r3894`, `SYprA`'s "Track projects" moved.
- [ ] Track / Choose what to track (`scvkE`), a group's header `sm`: Select none `QCqjt`, Show all 312 `e45quU`
  (`gQ61z`) → `koNTC`, `ISHAg` (`Button / sm · outline`, the code's `groupActionLook`); `VwMkr` (shown, Show) and
  nine instances' "Track all" moved.
- [ ] Repository / Header · not tracked (`tb2FD`): Read more `yLqgV` (`gQ61z`, hidden) → `rWgEz`
  (`Button / sm · ghost`, as the code's); `H6PiuZ` shows it.
- [ ] Repository / Header · Commits (`RepDQ`): its Right part replacement (`sxsSB` → `Azkao`, children re-id'd:
  `wmieQ` → `v8TPFE`, `bFSxx` → `m7KQy3`, `fKVWS` → `TR7lr`; nothing pointed at them) holds Open on GitHub `aKbOd`
  (`HtcJe`) → `RMH7r` (`Icon button / sm`, github).
- [ ] App · Settings, screens:
  - G9 account page `md`: Open profile on GitHub `Fqwed`, Request approval `BTQT0` (`EoODS`) → `uy7Pl`, `bIQ6d`
    (`Button / md`, arrow-up-right); Sign out and clear `u7toBt` (`EoODS` drawn red) → `nPfWV` (`Button / md · danger`,
    log-out);
  - T18 and T22 dialog footers: Cancel `S1DNED`, `a4qY8` (`JOjbe`, 24) → `n6rqR`, `vSOnx` (`Button / md`, Esc); Track 2
    repositories `plCzj`, Track 1 project `h5bs9` (`EoODS`, light) → `WUZnM`, `xVFG8` (`Button / md · primary`, plus);
  - T22 group actions Show `qA73k`, Select all `UxJ9M`, Show closed `SEfd2` (`gQ61z`) → `qfOc8`, `AAm4P`, `OG58h`
    (`Button / sm · outline`, as the code's `ProjectChooser`);
  - T4, T7 Turn off `RAiiA`, `haya4` (`syf0m`) → `t2FX0Z`, `tbktf` (`Button / md`);
  - T6 dialog's actions: hand-drawn Combine and turn on `lWVmQ` (27) → `MLRqB` (`Button / md · primary`); Cancel `q9hdR`
    (`JOjbe`, 24) → `U8ovl` (`Button / md`, Esc);
  - nine `Settings / Section` instances (`nPgl2`, `rm6NI`, `CJwm5`, `OMjCC`, `cnrP3`, `bgmkW`, `sc1pF`, `ocatW`,
    `cWv8Z`), a settings block `md`: the Tracking slot's replacement (re-inserted, its ids regenerated: `y6uQX` →
    `Zvpbp`, `HHbvt` → `f3am2c`, `tYWpO` → `lBzvz`, `th2Bu` → `GC30x`, `UzJr4` → `c7MxC7`, `h1Ueg` → `cWL97`, `O1yd9`
    → `dMadA`, `J7T2b` → `zaH6r`, `u2Yrz8` → `zTMuh` and their children; nothing pointed at them) has its Untrack /
    Stop tracking (`gQ61z`, 24) as `Button / md`.
- [ ] App · First sign-in and choosing what to track, screens (the page's call to action and its neighbours `lg`):
  - footers of G2, G4, G5, G12, G13, G14, G15, G18, G19: Only my repositories (`syf0m`, `md`) → `Button / lg`
    (`twA5I`, `jVuqb`, `w2g0LM`, `rUtut`, `f5KU2x`, `NGOSg`, `yTSs3`, `gwCjt`, `WUAxk`); hand-drawn Track these (30,
    ⌘↵) → `Button / lg · primary` with its ⌘↵ (`f9eEly`, `hGgvU`, `MxLYu`, `h9lXRA`, `hhTwN`, `DAvrs`, `oOfcQ`,
    `y6eBj`, `zX3Q8`), as the code's `TrackingChooser`;
  - G10: hand-drawn Continue to My work `EnPpj` → `o7LkC7` (`Button / lg · primary`, ⌘↵); Track beside the address
    field `tS83D` (`syf0m`) → `yNPFs` (`Button / md`, a form's action, the field already 50 tall);
  - G11: hand-drawn Load these `DBDPW` → `sbIvm` (`Button / lg · primary`, ⌘↵); No, I'll choose here `lnu8q`
    (`syf0m`) → `r2w1c` (`Button / lg`);
  - G5: Request approval on GitHub `D0QsAd` (`EoODS`, light) → `qeAR0` (`Button / md`, arrow-up-right), a card's
    action beside the page's primary Track these.
- [ ] App · Creating an issue, screens:
  - H9 error's actions `md`: hand-drawn Another repository `koEBz` (25, accent, ⌥R) → `LHJin` (`Button / md`, ⌥R,
    secondary as the code's); Save as draft in Platform Q4 `nTUiT` (`syf0m`) → `JDxgm`; Copy Markdown `iqUtW`
    (`EoODS`) → `KCFOP` (`Button / md`, copy);
  - H4 dock: hand-drawn Create issue `rG7Yv` (30) → `L8LOzi` (`Button / md · primary`, ⌘↵);
  - H5 project header: hand-drawn icon-only Display `NrkXC` (26 × 22) → `edn6O` (`Icon button / sm`);
  - the repository field picker (`sm · outline`, the code's): hand-drawn Repository chips (21) `A4dr2x`, `ZnzE2`,
    `DoJ5k`, `wuOul`, `RK7br`, `dvgUq`, `tQyEd` → `z7f1su` (H1), `ilyle` (H3), `D4Bun` (H5, stroke `$accent` kept),
    `UBszw` (H6), `fPUjS` (H7), `KwwJ0` (H8), `XoMTg` (H9, stroke `$red` kept), `Button / sm · outline` with lock or
    book-marked and the trailing chevron in the Key slot (the code puts it in the label);
  - Assign to me (22, ⌥A) `QfxMx`, `i4uz4f`, `X2M8sG` → `CGE6g` (H1), `XXLbs` (H5), `GrcyS` (H6)
    (`Button / sm · outline`, user, ⌥A).
- [ ] Toolbar controls showing a value, hand-drawn (23) → `Button / sm · outline`: Group: Milestone `v0B3C` → `w1Z8ci`
  (J1), Group: Issue type `o9c25` → `y5RYnE` (J2, its `$bg-3` fill dropped), Display `a5vs9` → `shWFi` (E4), `BG0fK` →
  `g72i6` (R2), Group: Milestone `xTWbB` → `OL3ha` (R3), Display `gTFn7` → `aSOg2` (K2), `i8RTSM` → `YGesf` (K6),
  `J1wYj` → `lklq1` (K9), `mEl1G` → `FQEbq` (K7), Group: Reason `xWFne` → `cA5Ep` (K5).
- [ ] App · Project, D4's Display popover: hand-drawn Reset `VyJl2` (21) → `K9hrH` (`Button / sm`, rotate-ccw), a
  row's inline control.
- [ ] Desktop · Sign in with a device code, `lg`: hand-drawn Sign in with GitHub `v4fEU`, `vlQjM` → `dm8FP` (S1),
  `g3PND` (S4); Copy code and open GitHub `vOpj9` → `Wdj3u` (S2); Get a new code `WAiP5` → `L3IYSi` (S3)
  (`Button / lg · light`, their icons and ↵ key); Cancel `q7XAY` → `Wirpf` (S2, `Button / lg`, Esc).

Left as they are:

- App · Mobile: its only old buttons are in `Phone / Composer dock · typing` (`BGx6I`, two) and slot replacements in
  `Phone / New issue / Details`, `Phone / Composer dock · closed issue` and `· pull request` (`J7HpC4`, `UuizA`,
  `tnhAD`), all `Phone / …`, which this round doesn't touch. Its non-phone parts hold no buttons (MB83's Safari chrome
  and avatars).
- The new issue's other field pickers (Labels, Milestone, Type, Parent, Project, Platform Q4, Status…) are
  `Chip / icon` (`dpOwt`) and hand-drawn removable chips, 21 px beside the 24 px Assign to me. Moving `Chip` onto
  `Button / sm · outline` is App · Components' round.
- Not buttons under the guideline: the choosers' Sort and Activity filter (a `span` in the code), the owner list's
  rows, the "Changed here · Reset" chips (E4, R2, K2), the projects bar's pills, the not tracked badge, segmented
  List / Board options, the command menu's context chips, view tabs, quick filters, the empty state's waiting link,
  the Undone row links, the address-field examples and MB83's Safari chrome.

## Round 2e · agent brief

Asked (`.context/button-system-brief-2e.md`): every button in App · Components (`pUvet`) and the `Components · …`
frames drawn with the family at its place's size and variant, then the old button components that are no longer used
deleted.

Changed: 15 instances of old button components and 19 hand-drawn buttons became family instances. Each was inserted
into a scratch frame, moved to the old node's index, then the old node was deleted. No `Replace` was used inside a
component. Pen drops overrides that point into a deleted node, so the 94 overrides other instances held were re-applied
on the new ids. Where a variant needs a different member for one state (a destructive Discard, the issue's split
Close, a lit Merge), the other member sits beside the original, hidden, and the variant shows it. The old style
overrides (padding, a red fill painted on a primary) were dropped. The eight old components nothing uses any more were
deleted. `Button / medium` (`TH5d7`), `Button / medium · primary` (`t0PlX5`), `Button / medium · menu` (`L4s15U`) and
`Button / small, outline` (`gQ61z`) stay, because `Phone / …` components still use them.

- [ ] Activity / Comment (`WHy4W`), the failed card's actions `md`: Discard `AQsyM` → `C7wjCV`, Retry `SA15Q` → `U00fwv`
  (`Button / md`, rotate-cw; its `$fg-2` icon now takes the label's colour).
- [ ] Activity / Thread · failed (`V75cQv`): Try again `Z7ltJ` → `WAnBj` (rotate-cw), Open on GitHub `G0C6RH` → `D8qiJZ`
  (arrow-up-right), `Button / md`.
- [ ] Activity / Editor (`OXAXr`) footer `Y9bgGG`: Close `wYaxO` → `nWkY8` (`Button / md`, git-pull-request-closed
  `$red`, ⇧X); new hidden `vhL5E` (`Split button / md`, circle-check `$purple`, "Close issue", ⇧X); new hidden `c8zddO`
  (`Button / md · destructive`, "Discard", ↵); Comment `gAIL0` → `CaBvk` (`Button / md · primary`, ⌘↵, opacity 0.45).
  As in the code (`ItemThreadComposer.vue`): an issue's Close is a split button, a pull request's Close and Reopen are
  plain buttons.
- [ ] Overrides moved onto the editor's new ids: `G3hGNp`, `G7spc`, `d7Rk1Q` → `kTpfA`, `xBKa6`, `DwI8a` (Close with
  comment, Comment lit); `BWMUY`, `FoNd9` (Reopen issue / pull request); `yL1Bq` (Close hidden); `ehuxk`,
  `n2U14` → `WZSfd`, `phPkk` → `yhNhK` (Cancel, Esc; Update comment, Reply).
- [ ] Activity / Composer · issue (`AljH1`): its replacement of the Close slot with `L4s15U` (`UQGRX`) is gone; it hides
  `nWkY8` and shows `vhL5E`. `G7spc` labels the split "Close with comment".
- [ ] Activity / Comment · editing, discard? (`BVHXx`): Comment painted `#DA3633` as "Discard" → Comment hidden,
  `c8zddO` shown (`· destructive`); Close reads "Keep editing", Esc.
- [ ] Activity / Comment · narrow, editing, discard? (`SSKJn`) and `· narrow, editing · phone` (`w6BzvV`): the padding
  7 12 overrides are dropped (the member keeps its size); the hidden keys are kept.
- [ ] Review / New comment (`SAmev`), its footer replacement `y5QcQW`: Cancel `CVvqY` → `Q2VsKB`, Second `pYysZ` →
  `IQFd4` ("Start a review", ⌘⇧↵), First `auMHj` → `d7Asqn` (`· primary`, Comment, ⌘↵), all `Button / md`; new hidden
  `FHDUx` (`Button / md · destructive`, Discard, ↵). Overrides moved: `c0AL2N` (Submit draft (4 comments), Add to
  draft), `b6KYNz` (Comment now, Start a review), `OMVhL` → `Vmijc` (Reply).
- [ ] Review / New comment · asks to discard (`y4kGY9`): Second painted `$red` as "Discard" → Second and First hidden,
  `FHDUx` shown; Cancel reads "Keep writing".
- [ ] Item / PR merge (`BioKQ`) Actions `D2HO8`, a card's actions `md`, as `PullRequestMerge.vue`: hand-drawn Merge
  `SRALN` → `wqQfi` (`Button / md`, git-merge, "Merge pull request", ⇧M as text, as the editor's ⇧X) and new hidden
  `D1N17` (`Button / md · primary`, the same); Open on GitHub `aUP2E` → `zZZb7` (github, O); Review files `nr4kB` →
  `WWa4u` (file-diff, D, secondary, was ghost). The icons are off in the component: the code drops them under 560 px,
  and three buttons with icons need about 540.
  - The 580 px merging cards (`vSpbJ`, `v6CZn`, `q9eCkj`, `DEdfl`, `VJOXK`, `DISxv`, `TsAaL`, `kUaDx`, `P1kGS2`) turn
    the icons on; their state labels, icons and keys moved (Delete branch ⇧D, Queue, Auto-merge, Resolve on GitHub,
    Update branch U, Mark ready, Back to the merge).
  - The 512 px cards (`U1eor` in `pX8Wm`, `E3s3O`, `cxxI7`, `N5EEiJ`, `SNGx9`, `g233G`, `ZUCsW`, `xZmAP`, `ov9XI`,
    `h80HI`, `cxl79`, `O7Jjgh`, `qwE2a`) keep the icons off; the ones that painted Merge accent (`EFhBM` and `a4Nljg`
    through `U1eor`, `Y2FX64` through `XPhTt`, `g233G`, `ZUCsW`, `cxl79`, `lCo9U` through `b24mtF`) hide `wqQfi` and
    show `D1N17`; `E3s3O`, `cxxI7`, `vSpbJ`, `VJOXK` hide Merge.
  - The summary column (`XPhTt` in `Item / Summary · pull request`, 376 px): no icons, "Merge". The keys stay hidden:
    with them the row needs 393 px. That follows the code's narrow rule (under 480 px it drops the key hints too), not
    the brief's "keep their keys".
  - `Item / PR merge · phone` (`T6Pdf7`): icons and keys hidden, "Merge"; the replacements of the keys by
    arrow-up-right are gone with the old slots. It stays `md` (no `lg` without a `Replace` in a component).
    `q5Pag`, `OA04b`, `xySZQ` (labels) and `lCo9U` (lit) moved through `b24mtF`.
- [ ] App · Components, Item sections column (`Pstd6`): width 460 → 480, so the merge card's three `md` buttons with
  their keys fit (470 px).
- [ ] List header / My work (`wjD5X`) and `· two filters` (`E7lOaZ`), as the code's `ListToolbarControl`
  (`Button / sm · outline`): Filter `A0i5R`, `r7icv` → `IizNh`, `neVUh` (list-filter); Group `cOEHe`, `twOBn` → `qoRJj`,
  `kYgnt` (rows-3). Moved: `vFg43` (Group: Repository), `Fo2qu` (hidden), `Wj9hW`, `wtNwW`, `wPUOp` (Group: Milestone,
  Label, None).
- [ ] Project pane / List (`MJtxW`), `/ Board` (`Wk5sR`), Project / Filter bar (`LHimd`): Display `Qw5ZS`, `vf330` →
  `gSirg`, `avOax` (`Button / sm · outline`, sliders-horizontal; the Board's label hidden, as before; `R4VAUR`, `u4Flaw`
  hide the List's); Add filter `z6OwTj`, `R1Tv2`, `cVeqZ` → `cuBsl`, `x5b9P2`, `iJRbC` (`Button / sm · ghost`, plus, F);
  the Board's Reset view `Dwro9` → `o3vVkO` (`Icon button / sm`, rotate-ccw).
- [ ] Hand-drawn icon-only buttons → `Icon button / sm`: Sidebar / expanded Collapse `hndIV` → `s0ghhc` (`RPgGZ` keeps
  its `$bg-3`); Item / Toolbar Open on GitHub `ozgMo` → `w8fjd`, Close `dxRh4` → `JPBzJ`; Repository / Header · not
  tracked github `HcPlj` → `NcKAK` (`v0HUZ`, `ftc6r` hide it); Review / Conversation Close `Z2T1UJ` → `l7i0JB`.
- [ ] App · Toolbar — view options fit… (`xFD8r`), Header `xqOW2`'s Right part replacement `r54Rv`: Open on GitHub
  `DZXQX` (`Button / icon`) → `Xxg3S` (`Icon button / sm`, github).
- [ ] Deleted: `Button / icon, label, key` (`n73Aps`), `Button / icon, label, no key` (`m1uQkH`), `Button / label, key`
  (`JOjbe`), `Button / label, no key` (`Dhiuj`), `Button / icon, label` (`EoODS`), `Button / label` (`syf0m`),
  `Button / label, icon key` (`vAXUD`), `Button / icon` (`HtcJe`).
- Not changed: Update / Status bar (`SoI9D`)'s Restart and Later (`cgBnL`, `ttyBv`) stay text actions inside the
  status bar segment (16 px), which doesn't grow for a button. Toggles, segmented controls, links (Edit, Change), Diff / File
  header's Viewed toggle and the sidebar rail are outside the guideline.

## Round 3 · implementation

Forced by: the final compliance check of the built code against the design (`.context/button-system-brief-3.md`).
Code review's selection bar draws Mark viewed `secondary` in `packages/app/review/ReviewFileList.vue`: the review's one
accent action is Submit review.

- [ ] Review / Selection bar (`YiQJ9`), its only instance `JCimW` in Review / File list (`SgpvP`), shown by CR23 · Ten
  files selected: Mark viewed `Wih4M` (`Button / sm · primary`) → `F83zG` (`Button / sm`, the secondary base),
  "Mark viewed" with V. No overrides pointed into the old node.
- Not changed: the file notes' buttons are already `Button / md` with no size overrides, as `ReviewDiffRow.vue`: Open
  on GitHub in Diff / File note · binary (`aPT6Y`, and through it `· too large` `PslUs` and `· renamed` `NGjwk`), CR67's
  failed note (`apjNE`: Try again `vSTqP`, Open on GitHub `qyXYL`) and CR68's waiting-for-allowance notes (`eGdOD`,
  `xId51`).
