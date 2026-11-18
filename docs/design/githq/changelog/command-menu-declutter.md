# Command menu declutter

With nothing typed, the command menu shows what fits the moment: the context's actions, then **Recent** (up to five
places and items opened lately, newest first, never the one on screen), then **Go to**, which ends with
"Repositories…" and "Projects…" levels in place of the full lists of tracked repositories and projects. The App group is
gone from the empty menu; typing finds app-wide actions and everything else as before. Base: `3dd802a0`.

## Round 1 · agent brief

Asked (`.context/command-menu-declutter-brief.md`, not committed): the calmer empty menu on an open item (to compare
with E1), on My work with no subject, the Repositories… level, and two variants of what Recent holds.
Changed: three new screens in a new row, an amber variants frame with two screens, new parts in `Components · Command
menu`; E1–E10 and the existing shared components untouched. The menu is drawn at its 480 px cap with a scrollbar. E11
and E12 also show their whole list unclipped beside the screen, since the cap hides Recent and Go to.

- [x] Components · Command menu (`B7AwZ`): new group `Parts · Calmer empty menu` (`GK6KQ`) with `Command / Section`
  (`U1jIc`, the `Menu section` heading with the rows' 10 px inset), `Command / Result · selected` (`DOwi8`),
  `Command / Result · opens a level` (`EZkQt`: count as Sub, chevron, no Right), `Command / Result · item` (`UUs6v`:
  the reference as Sub in mono), all variants of `Command / Result` (`k3mGr`).
- [x] Components · Command menu › Parts · Calmer empty menu (`GK6KQ`): `Command / Chip` (`Z0FaRU`), its
  `· reference` variant (`LkqY3`, mono, the subject chip), `Command / Input row` (`Kn0hN`: chip, a crumb separator and
  crumb off by default, caret, placeholder), `Command / Footer` (`Tkzk6`: Move, Run, Open submenu, Remove context,
  Close off by default, note).
- [x] App · Command menu (`D27jC`): new `Group header` (`gJqfI`) "A calmer empty menu" and `Row of screens · Calmer
  empty menu` (`zzInK`) after `DYjbN`.
- [x] Row of screens · Calmer empty menu (`zzInK`): new `E11 · ⌘K on an open item · empty, calmer` (`E4srSI`), E1's
  situation: the issue's ten actions and My work's three unchanged, then Recent (webapp#1205, Platform Q4,
  fitloop/api, api#318, tasklet Roadmap) and Go to (My work and its four groups, Draft reviews, Broken workflows,
  Settings, Repositories… 4, Projects… 3); the whole list beside it (`FNkie`).
- [x] Row of screens · Calmer empty menu (`zzInK`): new `E12 · ⌘K on My work · no subject` (`J1mJg`): sidebar
  collapsed to the rail, no panel, no list selection, no chip; My work's actions (Expand sidebar), Recent, Go to with
  Repositories… 12 and Projects… 5; no Remove context hint; the whole list beside it (`C7ZYNJ`).
- [x] Row of screens · Calmer empty menu (`zzInK`): new `E13 · Repositories… entered` (`U6RVn`): crumb "Repositories"
  in the chip's place, "Filter repositories…", the twelve tracked repositories by owner (fitloop, mlaine,
  skyline-labs) with open counts (not built: removed in round 7), each opening its own submenu; footer Move, Open, Open submenu, Back, Close, "12
  tracked · type to filter".
- [x] App · Command menu (`D27jC`): new `Variants · What Recent holds` (`QI4kh`, amber): `E14 · Variant A · Places and
  items mixed` (`CBAUZ`, recommended, as in E11/E12) and `E15 · Variant B · Places only` (`AWDPM`: Platform Q4, its
  Current sprint view, fitloop/webapp, skyline-labs/portal, tasklet Roadmap).
- [x] Canvas: every top-level frame from the flows row down (`Zk4sa`, `gvCqI`, `i3VkT`, `epLfx`, `iZkBN`, `O6Vuj8`,
  `Sz7Bf`, the platforms row, the web and brand row, the stray node `BnN7r`) moved down 2,708 px so the menus row,
  now 5,424 px tall, keeps 1,200 px above the next row.

Choices the brief left open:

- E12 and E13 collapse the sidebar to the rail so the larger set of tracked repositories (12) and projects (5) does not
  contradict a sidebar listing four and three; E11 keeps E1's sidebar and its counts.
- Go to's row for workflows is "Broken workflows", the label the sidebar and the app use, not "Workflows".
- On My work, Go to still lists My work; only Recent leaves out the place on screen.

## Round 2 · agent brief

Asked (`.context/command-menu-declutter-brief-2.md`, not committed): "the scrollbar overlaps the highlighted row". In
E11–E15 the 4 px scrollbar sat at 672–676 px over the rows, which ran to 674 px. New rule for the menu's list: when
it scrolls, the scrollbar has a gutter of its own and every row and heading ends before it; when it does not scroll,
no gutter and no scrollbar, rows full inner width with equal insets.
Changed: the right padding of the five scrolling lists. The scrollbar stays where it was, now 4 px clear of the rows
and 4 px from the menu's edge (a 12 px gutter). The lists are per-screen frames, not a component, so each screen got
the same change; the rows and headings are `fill_container` instances and follow the padding. E1–E10 and the unclipped
whole lists beside E11 (`FNkie`) and E12 (`C7ZYNJ`) don't scroll and keep 6 px on both sides; E2 (`ieMkl`) is the
non-scrolling example, rows full width.

- [x] E11 Results (`xvCh7`), E12 Results (`oajv2`), E13 Results (`Jo3U6`), E14 Results (`pvAiu`), E15 Results
  (`xs2Av`): padding `[4,6,8,6]` → `[4,12,8,6]`, rows 668 → 662 px wide, ending at 668 px; scrollbars (`S9ufb`,
  `IUsbE`, `Y8txRS`, `p8Nmg`, `x4afN`) unchanged at 672 px.

## Round 3 · agent brief

Asked (`.context/command-menu-declutter-brief-3.md`, not committed): the footer as the app draws it
(`CommandMenu.vue`, `hints`). `>` is one more key hint in the row, not "Type > for commands only" pinned to the right
edge. At the top level: Move, Run, Open submenu (while the highlighted row opens one), `>` Commands only, Remove context
(while a chip shows the subject or the repository). Inside a level: Move, Run, Open submenu, `←` Back, Esc Close.
Inside a picker: Move, Set, `←` Back, Esc Close.
Changed: the shared footer, and every hand-drawn desktop command menu footer swapped for an instance of it that sets
only which hints show. Each screen's hints follow its own state: chip or not, highlighted row opening a submenu or not.
Notes the code has no source for are gone: "Matches in tracked data, instant", "Each item is updated on GitHub in the
background", "12 tracked · type to filter". So are hints it doesn't draw: `#` Search by number, `⌫` Search everywhere,
`1–7` Pick, `⇧↵` Run and keep open, `⌫` Clear selection, `⌫` Back.

- [x] Command / Footer (`Tkzk6`): new `Hint Commands only` (`Hxnl8`, `>` key cap, after Open submenu) and `Hint Back`
  (`B5cKg`, `←`, off, before Close); spacer and "Type > for commands only" note removed. Default: Move, Run, Open
  submenu, Commands only, Remove context.
- [x] Command / Menu · search repositories (`r5WU3O`) › Footer (`zgunc`): Back's key `⌫` → `←`. Its note "Asks GitHub ·
  org: and stars: work" stays: the code shows a picker's hint at the footer's end.
- [x] E1 (`SbPDO`): footer → instance `JIT1f`: Move, Run, Open submenu, Commands only, Remove context.
- [x] E2 (`ieMkl`): footer → instance `nU98d`: Move, Set, Back, Close (was `1–7` Pick, Set, `⌫` Back, Close).
- [x] E3 (`uGavg`), E5 (`YorXE`): footers → instances `FZfZ7`, `M4r3JL`: Move, Run, Commands only.
- [x] E4 (`d45Gg4`): footer → instance `cX554`: Move, Run, Commands only, Remove context.
- [x] E6 (`M2ikYI`): footer inside the search component's instance → instance `VeMJm`: Move, Run, Commands only, Remove
  context (Open submenu dropped: Show as board opens none).
- [x] E7 (`MsoAv`), E9 (`TFxqV`), E10 (`xkY2C`): Move shown again (the code always shows it): Move, Back, Close.
- [x] E11 (`qODk6`, `O2d0m`): unchanged instances, now with Commands only in the row.
- [x] E12 (`pir9A`, `tU2sZ`), E14 (`p0WBT`), E15 (`m0DPh`): footers re-made: Move, Run, Commands only (Open submenu
  dropped: Show as board opens none).
- [x] E13 (`UrxMz`): Move, Run, Open submenu, Back, Close (was Open, `⌫` Back and the count note).
- [x] U20 (`AaZUD`), Settings ⌘K (`SPnft`), W4k (`C2rdgC`), W40 (`lgokF`): footers → instances: Move, Run, Commands
  only.
- [x] W41 (`eNKzT`): footer → instance: Move, Run, Open submenu, Commands only.

Left as they were, already as the code draws them: W36, W46, W47, W48 (their hints match; the note at the end is the
highlighted row's or the level's hint) and W37 (a form's footer). Not changed: the landing page's command menu
illustration (Feature 06, desktop and mobile), a picture on a page, not a screen.

Choices the brief left open:

- E3, E5, U20 and Settings ⌘K draw a place ("Platform Q4 · Current sprint") as the chip, which the code never does: it
  shows only a subject or a repository. Their footers leave out Remove context, as the code would; the chip itself is
  out of this round's scope.

## Round 4 · merge with main (#350)

Asked (`.context/command-menu-merge-brief.md`, not committed): resolve the `githq.pen` conflicts from merging
`origin/main`. Both sides grew `App · Command menu` (`D27jC`): this branch by the Calmer empty menu rows and moved the
frames below it down by 2708 px; #350 by `Parts · Item results`, `Group header · Found items, two lines` and `Row of
screens · Found items` (log: `command-menu-item-rows.md`) and moved the same frames down by 1292 px. The driver kept
ours for the 21 conflicting `y` values.
Changed: the frames below the menus row only. `D27jC` is a vertical layout, so both sides' rows already stack without
overlap: main's Found items header and row, then this branch's Calmer empty menu header, row and the variants frame.
It now ends at 75215 px, so the next row starts 1200 px below, at 76415 px (base + 4000).

- [x] The 21 top-level frames below `D27jC` (`Zk4sa`, `gvCqI`, `i3VkT`, `epLfx`, `iZkBN`, `O6Vuj8`, `Sz7Bf`, `BnN7r`,
  `rV6qN`, `ohwJa`, `Ri8IR`, `jy6bO`, `JJOFX`, `ucqck`, `XCfAD`, `jv9Tp`, `ykYxo`, `I5wWZ`, `S5J7kt`, `nCTdq`,
  `PiKGF`): `y` +1292 (flows row 75123 → 76415, platforms 87880 → 89172, web and brand 130175 → 131467), relative
  offsets kept. No top-level frames overlap.

## Round 5 · the owner's picks, in the app

Asked (`.context/command-menu-declutter-brief-4.md`, not committed): the desktop menu's height cap is 600 px (was 480),
the open item's actions in E11 unchanged; Recent holds places and items mixed (Variant A); E13 is one flat list,
alphabetical by `owner/name`; Recent stays above Go to; no place chip the app doesn't draw; scrolled to its end, the
last row keeps the list's bottom padding above the footer.
Changed: E11, E12 and E14 at the 600 px cap; E13 flat, and short enough that the menu shrinks to it (the app sets
`max-height`, `CommandMenu.vue`); E14 drawn scrolled to its end with its last row highlighted (↑ on the first row wraps
there, `CommandMenu.spec.ts`), the end case of the breathing room. The whole lists beside E11 and E12 already end with
the 8 px padding above the footer. Made through the Pen MCP from the app's session, not a `pen` run: the file was open
in the app.

- [x] E11 Command menu (`OVeDx`), E12 Command menu (`T7KxF2`), E14 Command menu (`Nu3GO`): height 480 → 600; Results
  401 → 521 px tall.
- [x] E11 Scrollbar (`S9ufb`): 163 → 277 px (521 of 966 px). E12 Scrollbar (`IUsbE`): 253 → 419 px (521 of 638 px).
- [x] E14 Results (`pvAiu`): `justifyContent` start → end, the list scrolled to its end; Scrollbar (`p8Nmg`) 253 →
  419 px, y 4 → 98, at the track's end.
- [x] E14 Results (`pvAiu`): "Projects…" `EZkQt` (`i13tL`) → `DOwi8` instance `tQm5H`, highlighted, with its count and
  chevron; "Show as board" `DOwi8` (`mjJYp`) → `k3mGr` instance `VeRb6`, same content, no longer highlighted.
- [x] E14 Footer (`p0WBT`): Open submenu shown (the highlighted row opens a level): Move, Run, Open submenu, Commands
  only.
- [x] E13 Results (`Jo3U6`): section headings fitloop (`DpMn5`), mlaine (`WxmR5`), skyline-labs (`CXrTb`) and the
  Scrollbar (`Y8txRS`) deleted; padding `[4,12,8,6]` → `[4,6,8,6]` (no scroll, no gutter); height `fill_container` →
  `fit_content`. E13 Command menu (`Yc6KM`): height 480 → `fit_content` (449 px).
- [x] Variants · What Recent holds (`QI4kh`, amber): deleted, with `E15 · Variant B · Places only` (`B1QvU`, `AWDPM`).
  `Slot · E14 · Variant A · Places and items mixed` (`rsN4z`) moved to the end of `Row of screens · Calmer empty menu`
  (`zzInK`) and renamed `Slot · E14 · Places and items mixed`; its screen (`CBAUZ`) and caption title (`Q5IQn5`) the
  same. Code E14 kept; E15 is not reused.
- [x] Captions: Group header note (`uM2CE`), E11 (`RdtML`), E13 (`OfvE8`) and E14 (`s6AEw`) rewritten for the 600 px
  cap, the flat list, the scrolled end and the settled pick.
- [x] E3 (`uGavg`), E5 (`YorXE`), U20 (`yFqlX`), Settings `E5 · ⌘K · Settings` (`BO0pf`): the place chip "Platform Q4
  · Current sprint" deleted (`zjMmm`, `lp2XK`, `WTDKc`, `hKqtZ`); the field starts with the query.
- [x] `E11 · Found items · two lines` (`brt0M`, from #350): its place chip (`y3cre`) deleted too, by the same rule.
- [x] Canvas: the 21 top-level frames below the menus row (as in round 4) moved up 1,150 px, so the row, now ending at
  74,065 px, keeps 1,200 px above the next (flows row 76,415 → 75,265).

Not changed: the landing page's command menu illustrations (Feature 06, desktop and mobile) keep their chip, a picture
on a page, not a screen.

Left for the owner:

- Two codes collide since the merge with #350: `E11 · ⌘K on an open item · empty, calmer` and `E11 · Found items · two
  lines`; and `E5 · ⌘K · Settings` in App · Settings shares E5 with App · Command menu.
- `E11 · Found items · two lines` still draws the old footer ("Search by number", "Search everywhere", "Matches in
  tracked data, instant") that round 3 replaced elsewhere.

## Round 6 · agent brief

Asked (`.context/command-menu-declutter-brief-5.md`, not committed): unique codes after the merge with #350, which
took E11 for `E11 · Found items · two lines` (`brt0M`); and that screen's footer as the app draws it.
Changed: this branch's four screens moved up one number, renamed in descending order so no two screens shared a code
at any moment. **Codes E11–E14 of rounds 1–5 are now E12–E15** (E15 of round 1, the deleted Variant B, stays retired
with its old screen). Made through the Pen MCP, not a `pen` run.

- [x] `Slot · E14 · Places and items mixed` (`rsN4z`), its screen (`CBAUZ`), caption title (`Q5IQn5`): E14 → E15;
  caption note (`s6AEw`): "E12's menu" → "E13's menu".
- [x] `Slot · E13 · Repositories… entered` (`kxw5Z`), its screen (`U6RVn`), caption title (`JDH0n`): E13 → E14;
  caption note (`OfvE8`): "goes back to E12" → "goes back to E13".
- [x] `Slot · E12 · ⌘K on My work · no subject` (`EnBNN`), its screen (`J1mJg`), caption title (`lFyXO`), `The whole
  list · E12` (`ikmRq`): E12 → E13; caption note (`e4R9d`): "(E13)" → "(E14)".
- [x] `Slot · E11 · ⌘K on an open item · empty, calmer` (`EK4Gv`), its screen (`E4srSI`), caption title (`cd171`),
  `The whole list · E11` (`s6c5qL`): E11 → E12.
- [x] `E11 · Found items · two lines` (`brt0M`) › Command menu (`SBAia`): the hand-drawn footer (`Ah771`: Move, Open,
  `#` Search by number, `⌫` Search everywhere, "Matches in tracked data, instant") → `Command / Footer` (`Tkzk6`)
  instance `n69mK`: Move, Run, Commands only. Open submenu off (the highlighted row, portal#1187, opens none), Remove
  context off (no chip since round 5).

Left for the owner: `E5 · ⌘K · Settings` in App · Settings still shares E5 with App · Command menu (out of this
round's scope).

## Round 7 · implementation

Asked (`.context/command-menu-declutter-brief-6.md`, not committed): bring E12–E15 in line with the built menu
(`CommandMenu.vue`, `buildCommandMenu.ts`, `AppCommands.vue`). Forced by: the built Recent draws an issue or a pull
request as every found item, on two lines (`Command / Item result`, E11 from #350), not as a one-line result; the built
Repositories… level lists `owner/name` only, and its crumb has no icon. Rounds 1–6 are built, so their entries are
ticked; round 1's E14 open counts were drawn but not built, and are removed here. Made
through the Pen MCP.

- [x] E12 Results (`xvCh7`), its whole list (`Q0Neg`): Recent's items webapp#1205 and api#318, `Command / Result ·
  item` (`UUs6v`: `cSspz`, `m7PFbs`, `WbvNA`, `sRbrd`) → `Command / Item result` (`F0DiHJ`: `SKngh`, `DLXFf`, `notH4`,
  `mL09q`): title on line 1 (no match highlighted, nothing typed) with its age, reference, state and avatar on line 2.
  Platform Q4, fitloop/api and tasklet Roadmap stay one line.
- [x] E13 Results (`oajv2`), its whole list (`yqYur`), E15 Results (`pvAiu`): webapp#1187 and portal#418 the same way
  (`MQMra`, `Z100vY`, `vRSFV`, `F6Nf1g`, `d0z0z5`, `a8Kll` → `Ni11f`, `gOGc3`, `CWEOA`, `H3zSq`, `teuyI`, `SjHrw`).
- [x] Scrollbars, for the list 38 px longer: E12 (`S9ufb`) 277 → 267 px; E13 (`IUsbE`) 419 → 404 px; E15 (`p8Nmg`)
  419 → 404 px, y 98 → 118, still at the track's end.
- [x] E14 Results (`Jo3U6`): the twelve repositories' counts (`MXfcN` on `sq0Vs` … `TrlLv`) hidden; rows show
  `owner/name` and the chevron.
- [x] E14 Input row (`LsQyy`): the crumb's icon (`IKS1h/KpeMV`) hidden: just "Repositories".
- [x] Captions: E14 (`OfvE8`) "its open issues and pull requests dimmed after the name" → "no counts", crumb with no
  icon; E15 (`s6AEw`) a place on one line, an item on two; "views" dropped from what Recent holds (a saved view counts as
  its project, D42).
- [x] Canvas: the 21 top-level frames below the menus row moved down 36 px (flows row 75,265 → 75,301), keeping 1,200
  px under `App · Command menu`, now ending at 74,101 px.

Checked, no change: Go to's counts ("My work 12", "Repositories… 12", "Projects… 5") follow the title in E12, E13 and
E15, as `CommandMenu.vue` now draws them (`commandMenu_count`, after the title, before the chevron).

## Round 8 · implementation

Asked (`.context/command-menu-declutter-brief-7.md`, not committed): follow `main`'s #355 (`reading-cursor.md` round
3), which dropped the trailing "…" from every button and command label, so the built rows read "Repositories" and
"Projects". Forced by: copy that changed in the code. Only command labels changed; placeholders ("Type a command or
search…", "Filter repositories…", "Search or jump to…") keep theirs. Made through the Pen MCP.

- [x] E12 Results (`E4srSI`) and `The whole list · E12` (`s6c5qL`): "Set status…", "Set priority…", "Set iteration…",
  "Assign to…", "Add or remove labels…", "Close issue…", "Group by…", "Repositories…", "Projects…" → the same without
  "…" (`y7WmmH`, `UXgUX`, `XO7h8`, `kRMWn`, `YGt6e`, `MQHZy`, `QqdfK`, `gClif`, `IoNrn`; `ZZn9x`, `sgOkY`, `mSi8U`,
  `X9zLL`, `X3MX34`, `uS879`, `Nn94c`, `mbnHg`, `Vv25N`), each instance's layer name too.
- [x] E13 (`J1mJg`), `The whole list · E13` (`ikmRq`), E15 (`CBAUZ`): "Group by…", "Repositories…", "Projects…" → no
  "…" (`u59lZ`, `o5Lx7r`, `pflMQ`; `nzYB9`, `AuCI4`, `XND1p`; `Gyj9I`, `Ts65A`, `tQm5H`), layer names too.

Checked, no change: E14 (`U6RVn`) draws no command label with "…" (its crumb already reads "Repositories"). Screen
titles and captions that cite "Repositories…" (`Slot · E14 · Repositories… entered`) keep their names, as codes and
titles stay.
