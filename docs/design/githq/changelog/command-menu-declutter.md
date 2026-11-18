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

- [ ] Components · Command menu (`B7AwZ`): new group `Parts · Calmer empty menu` (`GK6KQ`) with `Command / Section`
  (`U1jIc`, the `Menu section` heading with the rows' 10 px inset), `Command / Result · selected` (`DOwi8`),
  `Command / Result · opens a level` (`EZkQt`: count as Sub, chevron, no Right), `Command / Result · item` (`UUs6v`:
  the reference as Sub in mono), all variants of `Command / Result` (`k3mGr`).
- [ ] Components · Command menu › Parts · Calmer empty menu (`GK6KQ`): `Command / Chip` (`Z0FaRU`), its
  `· reference` variant (`LkqY3`, mono, the subject chip), `Command / Input row` (`Kn0hN`: chip, a crumb separator and
  crumb off by default, caret, placeholder), `Command / Footer` (`Tkzk6`: Move, Run, Open submenu, Remove context,
  Close off by default, note).
- [ ] App · Command menu (`D27jC`): new `Group header` (`gJqfI`) "A calmer empty menu" and `Row of screens · Calmer
  empty menu` (`zzInK`) after `DYjbN`.
- [ ] Row of screens · Calmer empty menu (`zzInK`): new `E11 · ⌘K on an open item · empty, calmer` (`E4srSI`), E1's
  situation: the issue's ten actions and My work's three unchanged, then Recent (webapp#1205, Platform Q4,
  fitloop/api, api#318, tasklet Roadmap) and Go to (My work and its four groups, Draft reviews, Broken workflows,
  Settings, Repositories… 4, Projects… 3); the whole list beside it (`FNkie`).
- [ ] Row of screens · Calmer empty menu (`zzInK`): new `E12 · ⌘K on My work · no subject` (`J1mJg`): sidebar
  collapsed to the rail, no panel, no list selection, no chip; My work's actions (Expand sidebar), Recent, Go to with
  Repositories… 12 and Projects… 5; no Remove context hint; the whole list beside it (`C7ZYNJ`).
- [ ] Row of screens · Calmer empty menu (`zzInK`): new `E13 · Repositories… entered` (`U6RVn`): crumb "Repositories"
  in the chip's place, "Filter repositories…", the twelve tracked repositories by owner (fitloop, mlaine,
  skyline-labs) with open counts, each opening its own submenu; footer Move, Open, Open submenu, Back, Close, "12
  tracked · type to filter".
- [ ] App · Command menu (`D27jC`): new `Variants · What Recent holds` (`QI4kh`, amber): `E14 · Variant A · Places and
  items mixed` (`CBAUZ`, recommended, as in E11/E12) and `E15 · Variant B · Places only` (`AWDPM`: Platform Q4, its
  Current sprint view, fitloop/webapp, skyline-labs/portal, tasklet Roadmap).
- [ ] Canvas: every top-level frame from the flows row down (`Zk4sa`, `gvCqI`, `i3VkT`, `epLfx`, `iZkBN`, `O6Vuj8`,
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

- [ ] E11 Results (`xvCh7`), E12 Results (`oajv2`), E13 Results (`Jo3U6`), E14 Results (`pvAiu`), E15 Results
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

- [ ] Command / Footer (`Tkzk6`): new `Hint Commands only` (`Hxnl8`, `>` key cap, after Open submenu) and `Hint Back`
  (`B5cKg`, `←`, off, before Close); spacer and "Type > for commands only" note removed. Default: Move, Run, Open
  submenu, Commands only, Remove context.
- [ ] Command / Menu · search repositories (`r5WU3O`) › Footer (`zgunc`): Back's key `⌫` → `←`. Its note "Asks GitHub ·
  org: and stars: work" stays: the code shows a picker's hint at the footer's end.
- [ ] E1 (`SbPDO`): footer → instance `JIT1f`: Move, Run, Open submenu, Commands only, Remove context.
- [ ] E2 (`ieMkl`): footer → instance `nU98d`: Move, Set, Back, Close (was `1–7` Pick, Set, `⌫` Back, Close).
- [ ] E3 (`uGavg`), E5 (`YorXE`): footers → instances `FZfZ7`, `M4r3JL`: Move, Run, Commands only.
- [ ] E4 (`d45Gg4`): footer → instance `cX554`: Move, Run, Commands only, Remove context.
- [ ] E6 (`M2ikYI`): footer inside the search component's instance → instance `VeMJm`: Move, Run, Commands only, Remove
  context (Open submenu dropped: Show as board opens none).
- [ ] E7 (`MsoAv`), E9 (`TFxqV`), E10 (`xkY2C`): Move shown again (the code always shows it): Move, Back, Close.
- [ ] E11 (`qODk6`, `O2d0m`): unchanged instances, now with Commands only in the row.
- [ ] E12 (`pir9A`, `tU2sZ`), E14 (`p0WBT`), E15 (`m0DPh`): footers re-made: Move, Run, Commands only (Open submenu
  dropped: Show as board opens none).
- [ ] E13 (`UrxMz`): Move, Run, Open submenu, Back, Close (was Open, `⌫` Back and the count note).
- [ ] U20 (`AaZUD`), Settings ⌘K (`SPnft`), W4k (`C2rdgC`), W40 (`lgokF`): footers → instances: Move, Run, Commands
  only.
- [ ] W41 (`eNKzT`): footer → instance: Move, Run, Open submenu, Commands only.

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

- [ ] The 21 top-level frames below `D27jC` (`Zk4sa`, `gvCqI`, `i3VkT`, `epLfx`, `iZkBN`, `O6Vuj8`, `Sz7Bf`, `BnN7r`,
  `rV6qN`, `ohwJa`, `Ri8IR`, `jy6bO`, `JJOFX`, `ucqck`, `XCfAD`, `jv9Tp`, `ykYxo`, `I5wWZ`, `S5J7kt`, `nCTdq`,
  `PiKGF`): `y` +1292 (flows row 75123 → 76415, platforms 87880 → 89172, web and brand 130175 → 131467), relative
  offsets kept. No top-level frames overlap.
