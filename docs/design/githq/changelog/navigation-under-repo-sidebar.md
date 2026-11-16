# A repository's and a project's navigation under it in the sidebar

githq has to work on smaller screens. The repository's own column (git-client D14; CH4–CH6, CH42) goes, with the
setting that chose it. Instead the open place, a tracked repository or a tracked project, expands in the main sidebar:
its sections or its saved views become indented sub-rows under its row. The header keeps its tabs while they fit, now
drawn as one tab group with a tooltip naming each tab's key. As the window narrows the header gives way in steps: view
options into Display, Display to an icon, the tabs to one dropdown. The phone's places panel follows the same model.
Spec: `.context/specs/2026-11-16-navigation-under-repo-sidebar.md` (PR #333). Base: `fa8f6bd4`.

## Round 1 · agent brief

Asked (`.context/navigation-under-repo-sidebar-brief.md`, not committed): variants of the header tab look and of the
sub-rows; the repository, project, toolbar, menu, Settings · Display and phone screens with the new navigation;
deletion of the column-layout screens.

Changed: two amber `Variants` frames (tab look, sub-rows), 13 new desktop screens, 2 phone screens, new components for
the tab group, the header, the sidebar sub-rows and the expanded places. The column-layout rows are deleted.

Picked by the agent, not by the brief:

- The screens show `fitloop/webapp` with its existing counts (Issues 118, Pull requests 24, Workflows 2), so the sidebar,
  the header and the list agree. The brief's `healedcare/healed` with Issues 0 · Pull requests 15 · Workflows 1 is used
  where it asked for it: the tab variants and the toolbar steps.
- In the tab variants the current tab is Issues and the pointer hovers Pull requests, so the tooltip "Go to pull
  requests `2`" shows on a tab that isn't already open.
- A project's views carry no count in the sub-rows, the dropdown or its menu, following the owner's change to the spec
  made during this round ("as its tabs have none"). Each view's sub-row has a layout icon (board or list), so its name
  lines up with a repository's sections.
- On the phone the expanded list is longer than the panel, so the panel's list is drawn scrolled and clipped (MB270
  scrolled to the expanded repository, as the spec says opening scrolls it into view).
- The view options that move into Display in step 1 are Open, Group, Order and Properties, the same set a project
  moves.

Left for the owner:

- `W15 · The Workflows section in the column layout` (App · Workflows, `gOvS3`) still shows the column. The brief named
  only CH4–CH6 and CH42, so it was not deleted.
- `Tabs / group` holds four items. A project with more saved views needs the component to take any number of items
  (a slot), or a five-item variant.

### Components

- [x] App · Components › Atoms (`U5qIGb`): new row `Tab group and section menu` (`YZ3kQ`) under `Tabs`.
- [x] `Tab / segment` (`OAxbv`): new. One tab in a group: label, plus a hidden cloud (`o6FOZ6`), count (`om1Pb`) and
  modified dot (`V8D89b`), each shown by its instances.
- [x] `Tab / segment · with count` (`PGGNf`), `Tab / segment · current` (`rrBZ7`), `Tab / segment · with count, current`
  (`e34gBd`): new variants of `Tab / segment`. The current one is filled `$bg-3`, its label `$fg` 500.
- [x] `Tabs / group` (`S7NcJg`): new, Variant A. A 1 px `$border` outline, radius 6, padding 2, gap 2, like the List /
  Board switch. Holds Issues, Pull requests (current), Commits, Workflows.
- [x] `Tabs / dropdown` (`EkbKS`): new. The tabs collapsed into one menu button: icon, label, count, chevron, in a
  bordered box.
- [x] `Menu / item · key` (`e1dJP`) and `· selected` (`zLn0z`): new. A menu row with icon, label, an optional count and
  check mark, and a key cap (`Kbd`).
- [x] Components · Repository (`yjoY1`): new group `Parts · navigation in the sidebar` (`nktC5`).
- [x] `Repository / Header` (`I3AnbD`): new. A `Left part` (`zvTXw`: visibility icon, title with chevron, `Tabs`, a
  hidden `Tabs dropdown`) and a `Right part` (`FPxDF`: Open, Group, Order, Properties, List / Board, Display, all
  `Repository / Tool · outline`), each filled `$bg`. The narrowing steps are instances that hide parts.
- [x] `Sidebar / sub-row` (`FueBC`) and `· current` (`IuMvE`): new. Indented so the icon starts at the place's name
  (32 px): icon, a hidden cloud, label, a hidden modified dot, count, a hidden red broken dot.
- [x] `Sidebar / expanded · repository open` (`DhmYq`): new instance of `Sidebar / expanded`. `fitloop/webapp`'s row is
  replaced by the place, open: the row (`$fg`, 500) and Issues 118, Pull requests 24 (current), Commits, Workflows
  (red dot, 2).
- [x] `Sidebar / expanded · project open` (`Aztvq`): new instance of `Sidebar / expanded`. `Platform Q4` with Current
  sprint (current, dot), Backlog, Next sprint (cloud), All items, without counts.
- [x] `Phone / Place row · group` (`dWgb5`): two hidden children added, `Modified dot` (`W1Gl4F`) and `Leaves for
  GitHub` (`K1GwWs`, ↗). Existing instances are unchanged.
- [x] `Phone / Place row · group, current` (`QGDhI`): new variant, filled `$sel` like the current place row.
- [x] `Phone / Places panel · a repository expanded` (`bPX1Y`) and `· a project expanded` (`LGMJ4`): new instances of
  `Phone / Places panel · in a repository`. The list sits in a clipped `Places, scrolled` frame and the flex spacer is
  hidden.

### App · Repository (`N1wdc`)

- [x] New `Group header` (`n0B0Fm`): "The repository's navigation, under it in the sidebar".
- [x] New `Variants · How the header tabs look` (`QVhRU`, amber): `CH67 · Variant A · One bordered group, the current
  tab filled` (`O7LAnr`, recommended), `CH68 · Variant B · An underline on the current tab, inside a bordered strip`
  (`Tyjv1`), `CH69 · Variant C · A filled pill on a subtle track, no border` (`gwlUf`). Each shows the tooltip "Go to pull
  requests `2`" (`Diff / Comment button · tooltip`). B and C replace the header's `Tabs` with a drawn strip.
- [x] New `Variants · Sub-rows under the open place` (`D1VJC`, amber): `CH70 · Variant A · A plain indent, like My
  work's groups` (`C0DLK`, recommended) and `CH71 · Variant B · An indent with a thin guide line` (`JnliA`).
- [x] New `Row of screens · Navigation in the sidebar` (`S6HY3`): `CH72 · Pull requests · the repository open in the
  sidebar` (`f9LyC`, copied from CH2), `CH73 · Issues · an issue open in the side panel` (`PFXUz`, copied from CH1, plus
  `Item view / stacked`, header at its last step), `CH74 · A pull request full screen · the repository stays open`
  (`z4Sz0i`, copied from F18). CH74's toolbar reads `fitloop/webapp #1228` instead of `mlaine/tasklet #15`, and so do three event numbers in its feed.
- [x] Deleted `Row of screens · Column layout` (`QbhvI`) with `CH4 · Column layout · Issues` (`uJ21s`) and `CH5 ·
  Column layout · Pull requests` (`Cv6Pm`). Superseded by the sidebar navigation; git history keeps them.
- [x] `Group header` (`r9nNSc`): title (`f0wCnQ`) "Two layouts of the repository view" → "The repository view's sections,
  as tabs". The note (`t9fdJ`) now says the column layout is gone and points to CH72–CH74.

### App · Commits (`DtWFt`)

- [x] Deleted `Row of screens · Column layout` (`t6smuu`) with `CH6 · Column layout · Commits` (`oK9kd`), `CH46 ·
  Resizing the left column` (`p9NY4`) and `CH42 · Column layout · A commit's details` (`eJqeE`). CH46 drew the
  repository's column. Its resize rule for the branch and tag list moved into the note `k9veH`.
- [x] `Group header` (`o7GlZ`): title (`LvCLp`) "1 · Commits in both layouts" → "1 · Commits in the repository's tabs".
  The note (`AvRbJ`) no longer describes the column layout.
- [x] Note `k9veH`: "in the column layout, the column's lower part" removed. The resize rule from CH46 added (200–480
  px, 280 by default, kept on this device, gives way down to 200 px).

### App · Toolbar — view options fit, the rest go to Display (`xFD8r`)

- [x] New `Board header · The repository header as the window narrows` (`pjYfJ`).
- [x] New `State · CH75 · 1 · The view options in Display` (`Dm54I`, 820 px pane).
- [x] New `State · CH76 · 2 · Display as an icon` (`YbJQ5`, 720 px), with the tooltip "Display".
- [x] New `State · CH77 · 3 · The tabs as one dropdown` (`QBet1`, 560 px).
- [x] New `State · CH78 · 3 · The dropdown open` (`vj5Is`, 560 px): Issues 0 `1`, Pull requests 15 `2` (checked),
  Commits `3`, Workflows 1 `4`.
- [x] New `State · CH79 · The left part above the right` (`EYcYr`, 900 px): the left part covers the right part's
  controls that don't fit, with an annotation for each part.

### App · Repository and project menu (`pgCGV`)

- [x] New `R4 · The repository menu · its sections with their keys, no Open` (`adcDp`), next to R1, copied from it. Open
  removed; Issues `1`, Pull requests `2`, Commits `3` (new, git-commit icon), Workflows `4` as `Menu / item · key`. The
  sidebar is `Sidebar / expanded · repository open` with Issues current, and the header is `Repository / Header` with
  the trigger filled `$sel`.

### App · Project (`JCfIb`)

- [x] New `Group header` (`Y8musf`): "The project's views, under it in the sidebar".
- [x] New `Row of screens · Navigation in the sidebar` (`G6OEJ5`): `D12 · Project as List · the project open in the
  sidebar` (`fSh91`). Its `Project pane / List` has the views as `Tabs / group` (Current sprint current with the dot,
  Backlog, Next sprint with the cloud, All items).
- [x] `D13 · Project · an item in the panel, the views as a dropdown` (`r6pLoA`): the views as `Tabs / dropdown`
  (Current sprint, no count), "Changed here" and the meta text hidden, Display as an icon, its menu open (`V8fBA3`).

### App · Settings (`i3VkT`)

- [x] New `Slot · CH80 · Settings · Display · Animations only` (`v1q8Yz`), beside CH43 and copied from it. The
  Repository layout column is removed, so only the Animations card stays.
- [x] CH43 caption note (`yhVMR`): starts "Superseded by CH80".
- [x] Group header notes: `h96G7` says Display holds Animations (CH80). `Vtt0e` no longer compares the settings screen
  to "the repository's column layout".

### App · Mobile (`jy6bO`)

- [x] New `Slot · MB270 · A repository expanded in the places panel` (`INdsN`), after MB53 and copied from it: the
  banner hidden, `fitloop/webapp` expanded into Issues 118, Pull requests 24 (current), Commits ↗, Workflows ↗.
- [x] New `Slot · MB271 · A project expanded in the places panel` (`ol6wm`): Platform Q4 expanded into its views over the
  project list (`Phone / List / Project · Current sprint`).

### Canvas

- [x] App · States (`epLfx`), App · Freshness (`iZkBN`), App · Loading and empty states (`O6Vuj8`) and App · Toasts
  (`Sz7Bf`) moved 1520 px right. App · Settings grew by CH80 and overlapped App · States.

## Round 2 · owner's picks

Asked (`.context/navigation-under-repo-sidebar-brief-2.md`, not committed): the owner picked CH67 (one bordered tab
group) and CH71 (sub-rows with a thin guide line); the guide line on every expanded place, desktop and phone; the
repository's book/lock icon inside the title button, before the name, at the project title's size and gap (16 px, 10
px), so icon, name and chevron are one clickable unit with one hover background; W15 deleted; "All items" shown only
while it is the view shown; `Tabs / group` taking any number of tabs, shown with five views on D12.

Changed: the two `Variants` frames are gone, CH67 and CH71 sit in a new row; `Sidebar / sub-row` carries the guide
line, so every expanded place on the desktop shows it; the phone has its own sub-row variants with the line;
`Repository / Header`'s title holds its icon; `Tabs / group` holds its tabs in a slot.

Picked by the agent, not by the brief:

- Platform Q4's five saved views are Current sprint, Backlog, Next sprint, By assignee (board) and Bugs (list), the
  same set in D12's tab group, the expanded sidebar (D12, D13), D13's views menu and MB271.
- The sidebar's guide line lives in each sub-row (a 1 px line at the place icon's centre, running 2 px up into the gap
  above), so a place with any number of sub-rows draws one unbroken line without a drawn overlay.
- The phone's `Phone / Place row · group` is shared with My work's groups, which keep no line, so the line is a hidden
  child shown only by the new `Phone / Place row · sub-row` variants.

Left for the owner:

- `Repository / Header · not tracked` (`tb2FD`, J3, J5–J7) still shows the icon outside the title and the word
  "public". The spec drops the visibility word there too; the brief named only `Repository / Header`.

### Settling the variants

- [x] App · Repository (`N1wdc`): new `Row of screens · The header tabs and the sub-rows` (`SN2Eo`) where the
  `Variants` frames were.
- [x] Deleted `Variants · How the header tabs look` (`QVhRU`) with `Slot · CH68 · Variant B · An underline on the
  current tab, inside a bordered strip` (`W9O47`, screen `Tyjv1`) and `Slot · CH69 · Variant C · A filled pill on a
  subtle track, no border` (`h9PlCT`, screen `gwlUf`).
- [x] CH67 moved into `SN2Eo`. Renamed: slot (`A9Y31`), screen (`O7LAnr`) and caption title (`HVMcR`) "CH67 · Variant A
  · One bordered group, the current tab filled" → "CH67 · One bordered group, the current tab filled". Caption note
  (`FqcEh`) "Recommended. The owner's suggestion…" → "The owner's pick…", plus the title's icon inside the button.
- [x] Deleted `Variants · Sub-rows under the open place` (`D1VJC`) with `Slot · CH70 · Variant A · A plain indent, like
  My work's groups` (`M0u07`, screen `C0DLK`).
- [x] CH71 moved into `SN2Eo`. Renamed: slot (`rJsYu`), screen (`JnliA`) and caption title (`zbSzj`) "CH71 · Variant B ·
  An indent with a thin guide line" → "CH71 · An indent with a thin guide line". Caption note (`mIVCw`) now says it is
  the owner's pick and that `Sidebar / sub-row` carries the line.
- [x] CH71's sidebar `VlGZu` (a `Sidebar / expanded` with the place drawn in and a `Guide` rectangle over it) →
  `TAqGP`, an instance of `Sidebar / expanded · repository open` at the same position.

### The guide line everywhere

- [x] `Sidebar / sub-row` (`FueBC`): new child `Guide` (`sPuOL`), absolute, x 15, y −2, 1 × 28, `$border-2`. Every
  sub-row instance shows it: `Sidebar / sub-row · current`, `Sidebar / expanded · repository open` (CH71–CH74, R4),
  `Sidebar / expanded · project open` (D12, D13).
- [x] `Phone / Place row · group` (`dWgb5`): new hidden child `Guide` (`qAyJ9`), absolute, x 22, 1 × 40, `$border-2`.
  My work's groups are unchanged.
- [x] New `Phone / Place row · sub-row` (`i27xk`, instance of `dWgb5`, `Guide` shown) and `Phone / Place row ·
  sub-row, current` (`oHde3`, instance of it, filled `$sel`), in Components · Mobile › Menus (`GnvbT`) after the group
  row.
- [x] Deleted `Phone / Place row · group, current` (`QGDhI`): round 1 made it for the sub-rows, which now use `oHde3`.
- [x] `Phone / Places panel · a repository expanded` (`bPX1Y`, MB270): the four sub-rows → `Phone / Place row ·
  sub-row`, Pull requests → `· sub-row, current` (new ids). Same content.

### "All items" and five saved views

- [x] `Sidebar / expanded · project open` (`Aztvq`): `Sub-row All items` (`dfQXC`) removed; new `Sub-row By assignee`
  (`Q8lML8`, columns-3) and `Sub-row Bugs` (`juPDo`, list). D12 and D13 follow.
- [x] `Phone / Places panel · a project expanded` (`LGMJ4`, MB271): sub-rows → the new phone sub-row variants (Current
  sprint current); All items removed; By assignee and Bugs added.
- [x] `Tabs / group` (`S7NcJg`): its four tabs moved into a new child frame `Tabs` (`QqSEm`, gap 2, a slot listing
  `Tab / segment`, `· with count`, `· current`, `· with count, current`). An instance replaces the slot to show any
  number of tabs; the border and padding stay on the group.
- [x] D12 (`fSh91`): the project pane's views (`NPHaG` › `o8OS7x`) replace the slot with `ns4fs`: Current sprint
  (current, dot), Backlog, Next sprint (cloud), By assignee, Bugs. All items gone. Caption note (`B1Gtz`): five views,
  the group takes any number, All items is a temporary tab.
- [x] D13 (`r6pLoA`): `Views menu` (`V8fBA3`): `Item All items` (`J0rx9N`) removed; new `Item By assignee` (`id57p`)
  and `Item Bugs` (`kBiPE`). Caption note (`owJqP`): "All items isn't listed: it appears only while it is the view
  shown."

### The repository title's icon

- [x] `Repository / Header` (`I3AnbD`): `Visibility` (`LxZ7B`, 16 px) moved from `Left part` into `Repository menu
  trigger` (`FV59l`), inside a new frame `Name` (`YQhqK`, gap 10) with `Title` (`Gp4jb`), followed by the chevron.
  The trigger's padding and radius are its hover and open background, now covering the icon too.
- [x] Moving the nodes dropped the instances' overrides into them; re-applied, same values: `Gp4jb` "fitloop/webapp"
  on CH72 (`B4T0j`), CH73 (`mXRrD`) and R4 (`VD4xc`); the tabs' counts and current tab on CH67 (`H3q05Q`: Issues
  current 0, Pull requests hovered 15), CH72 and CH73 (118, 24, 2), R4 (Issues current 118, Pull requests 24,
  Workflows 2).
- [x] CH72 caption note (`p4gMfd`): "the lock beside the name" → "the lock sits inside the title button right before the
  name… one clickable unit".
- [x] App · Repository group note (`lNXwe`): names CH67 and CH71, CH75–CH79, and the icon inside the title button.

### W15

- [x] App · Workflows (`gOvS3`): deleted `Slot · W15 · The Workflows section in the column layout`.
- [x] Caption note `bBxmR`: "in the tabs here and in the column layout (W15)" → "in the tabs here and under the
  repository in the sidebar (App · Repository, CH72)".

### Rebuilt with the same content

A failed call during the round rolled back by dropping overrides that pointed into the changed phone and sub-row
components. They were restored from the saved file; nothing visible changed.

- [x] CH73's sidebar `o6Hqn` → `vZN70` and R4's sidebar `nwW6w` → `rj2Hl`: new instances of `Sidebar / expanded ·
  repository open`, Issues current again.
- [x] MB141's `Places` (`nvzXK`): its count overrides re-applied.

## Round 3 · implementation

Asked (`.context/navigation-under-repo-sidebar-brief-3.md`, not committed): bring the file in line with what the built
code does. Forced by:

- **The title cut.** Below about 540 px the header with its tabs folded and Display as an icon still didn't fit: on
  Commits the `B` Branches and tags button and the GitHub link were covered. `ListToolbar` cuts the title as the last
  step, ending in "…", the full name in its tooltip. New CH81.
- **The untracked header.** `RepositoryView` passes the same title icon and title menu whether the repository is
  tracked or not, so the untracked header has the book inside the title button and no "public", as round 2 left open.
- **The project title.** `ProjectView` gives the title `SquareKanban` in the accent colour inside its button, which
  opens the project's menu (R2). D12 showed the icon in the accent colour but not the button, so `Project pane / List`
  and `Project pane / Board` get the trigger with its chevron, and every screen built from them shows it. The cloud
  on a project's tab and sub-row was already amber; nothing changed there.
- **The order in CH75–CH78.** `ListToolbar` keeps the filters longest, as before this feature, so the state ("Open")
  stays on the toolbar and the List / Board switch moves into Display with the view options. The file showed it the
  other way round.

Picked by the agent, not by the brief:

- CH81 sits after CH78 and before CH79, so the four steps read in order before the layering rule. Its pane is 520 px,
  where the title shows "fitloop/we…". The rows under it are `Commit row` instances, not the pull request rows of
  CH75–CH78.
- J3 draws its own header rather than using `Repository / Header · not tracked`, so the same change was made on it by
  hand.
- R2's project title, drawn by hand, gets its icon inside the button too, so the screen about that button agrees with
  D12.

Left for the owner:

- R1 (`Qj6qV`) still draws the lock outside the title button and the word "private"; R4 shows the current header.
  The Commits screens (CH3, CH10–CH41, CH47, CH48, CH64, CH65) draw the header from before this feature by hand:
  icon outside, "private", the old tabs.

### App · Toolbar — view options fit, the rest go to Display (`xFD8r`)

- [x] New `State · CH81 · 4 · The title cut` (`G8EsCW`) after CH78, copied from CH77: "520 px pane", caption "CH81 ·
  4 · The title cut" with the note "last, the name is cut with “…”, the full name in its tooltip" (`WSz2T`). Its
  `Repository pane` (`l3TGwZ`, 520 px) holds a `Repository / Header` (`xqOW2`): title "fitloop/we…", the tabs as
  `Tabs / dropdown` showing Commits (git-commit icon, no count), and the `Right part` replaced by `r54Rv`: `Repository
  / Tool` Branches and tags (git-branch) with `Kbd` B, and `Button / icon` with the GitHub icon (`DZXQX`). Under it
  three `Commit row` instances (`dYgK6`, `uvbtt`, `I3FHQm`) and the tooltip "fitloop/webapp" (`n5gY5`) under the
  title.
- [x] CH75 (`fGToQ`), CH76 (`BZePB`), CH77 (`Y5qdaz`), CH78 (`Xl1Lc`): `Tool Open` (`SbJoh`) shown, `Layout switch`
  (`HgDjc`) hidden; before, Open was hidden and the switch shown.
- [x] CH75 caption note (`WoEbx`): "Open, Group, Order and Properties move into Display, as on a project" → "Group,
  Order, Properties and the List / Board switch move into Display; the state filter, Open, stays longest".
- [x] Lede (`I2JwTl`): three steps → four; names the switch moving with the view options, the state staying longest
  and the title cut last.

### The untracked repository's header

- [x] `Repository / Header · not tracked` (`tb2FD`): new `Repository menu trigger` (`au8VR`, radius 5, gap 6, padding
  3/6) first, holding `Name` (`q9isd6`, gap 10) with the book icon (`KPSQH`, renamed `Visibility`, 16 px) and `Title`
  (`SEsS1`), then a `Chevron` (`Ui4qP`, 13 px, `$fg-2`), as in `Repository / Header`. `Meta` "public" (`aqX6z`)
  deleted. The "not tracked" chip and the read count stay after the title. J5 (through `Repository / Pane · not
  tracked`), J6, J7, ES17 and E6 follow.
- [x] J7's header (`v0HUZ`): the title override "vitejs/vitee" dropped by the move, re-applied. Its and ES17's
  (`ftc6r`) override hiding "public" went with the node; ES17's title override equalled the default.
- [x] J3's header (`YSzu1`): the same by hand: new `Repository menu trigger` (`kEWKd`) with `Name` (`pHjKA`) holding
  the book (`c17Ma`, renamed `Visibility`) and the title (`emHJn`), and a `Chevron` (`lpdRd`). "public" (`QilpD`)
  deleted.

### The project's title button

- [x] `Project pane / List` (`MJtxW`), `Project header` (`N1Mv21`): new `Project menu trigger` (`Xyhm7`) first,
  holding `Name` (`nZWSt`, gap 10) with the `square-kanban` icon (`brony`, `$accent`, 16 px) and the title (`W0GlrP`),
  then a `Chevron` (`csuzE`). D4, D12, D13, E3, E5, E7–E10, U20, the settings E5, ES18 and ES20 follow.
- [x] `Project pane / Board` (`Wk5sR`), `Project header` (`xbe8s`): the same, `Project menu trigger` (`mGrbx`), `Name`
  (`h9Xrf`) with `INfno` and `Poglf`, `Chevron` (`UniGT`). D5, ES19, ES30 and the landing's Feature 05 (desktop and
  mobile) follow.
- [x] R2 (`ArCu8`), `Project menu trigger` (`n6zelJ`): new `Name` (`Of8mc`, gap 10) holding the icon (`rcv7r`), moved in
  from before the button, and the title (`VlGJJ`).

## Round 4 · implementation

Asked (`.context/navigation-under-repo-sidebar-brief-4.md`, not committed): the two things round 3 left for the owner,
both only aligning drawings with the built code. R1 gets the current header. The Commits screens' hand-drawn headers
become instances of one component. `RepositoryView` gives Commits the title, the tabs, `B` Branches and tags and the
link to GitHub, plus "not tracked" when it isn't.

Picked by the agent, not by the brief:

- R1 only duplicates R4, so R1's menu stays as history (Open, no Commits, no keys) and a caption points at R4. R1's
  sidebar stays `Sidebar / expanded`, as drawn before the repository opened under its row.
- To give R1 a caption without lowering its screen, the row aligns its screens at the bottom. All four are 900 px tall,
  so their top edges still line up and only the caption sits above.
- The untracked Commits screens (CH10, CH11, CH17, CH44, CH45) need "not tracked" after the title. It is a hidden chip
  in `Repository / Header`, the same `Chip / icon` with `cloud-off` that `Repository / Header · not tracked` uses, and
  untracked screens show it. Those screens hide the tab counts and the Workflows tab, since an untracked repository has
  neither.
- CH22 (the keyboard walk's start, on Issues) is `Repository / Header` with Issues current, as in R4. Its right part
  is the component's (Open, Group, Order, Properties, List / Board, Display) instead of the drawn Filter, Open, Group,
  List / Board, Display and GitHub.
- CH37 records a screen that is no longer built. It gets `Repository / Header` for an untracked repository on Issues,
  with the right part hidden, because the drawn header had nothing there but the GitHub icon.
- CH38 (an empty repository) hides Branches and tags, as before.

Left for the owner: other screens still draw the pre-feature header by hand: CH1 and CH2 (App · Repository), the
Workflows screens (W13, W14, W16–W19, W35, W47, W48 and six more without a code), Desktop · Commits CD2–CD7 (with the
worktree tool), and ES9, ES10, ES14–ES16, ES21, ES22 and ES27 (App · Loading and empty states).
`Repository / Header · not tracked` (`tb2FD`) still draws its tabs as the old separate `View tab`s, not `Tabs / group`.

### Components

- [x] `Repository / Header` (`I3AnbD`): new hidden child `Chip not tracked` (`HUQ6h`, `Chip / icon`, `cloud-off`, "not
  tracked") in `Left part` after the title button. Existing instances are unchanged.
- [x] Components · Repository › `Parts · navigation in the sidebar` (`nktC5`): new vertical frame `Repository headers`
  (`J9yf6P`, gap 24) first, holding `Repository / Header`, which moved in, and the new variant below it.
- [x] New `Repository / Header · Commits` (`RepDQ`), an instance of `Repository / Header`: title "fitloop/webapp", tabs
  Issues 118, Pull requests 24, Commits current (`Tab / segment · current`), Workflows 2; `Right part` replaced by
  `sxsSB`: `Branches and tags` (`wmieQ`: `Repository / Tool` with `git-branch`, `Kbd` B) and `Open on GitHub` (`Button /
  icon`, `github`).

### App · Repository and project menu (`pgCGV`)

- [x] R1 (`Qj6qV`): the hand-drawn `Header` (`rIrFj`: lock outside the title button, "private · 142 open", old view
  tabs, Filter, Group, List / Board, Display, GitHub) → `NwiyZ`, a copy of R4's `Repository / Header` instance: lock
  inside the title button, trigger filled `$sel`, `Tabs / group` with Issues current (118, 24, 2). Menu unchanged.
- [x] New `Slot · R1 · The repository title opens its menu · tracked repository` (`Cfh50`) around R1, with a caption
  (`dcIRp`): title (`zmOsE`) and note (`rWhlG`) "History: the menu as first drawn, with Open and without Commits or
  keys. R4 is the repository menu now…".
- [x] `Row of screens` (`H5RBK`): `alignItems` start → end.

### App · Commits (`DtWFt`)

Each hand-drawn `Header` (lock or book outside the title, "private" or "public", old view tabs, a separate "not
tracked" chip) → an instance named `Header`, fill width. Other content unchanged.

- [x] `Repository / Header · Commits` with no overrides: CH3 (`yJNln` → `LLhmc`), CH47 (`TR7qo` → `mdZJw`), CH48
  (`uk96q` → `M05TK`), CH15 (`jIY9K` → `mPD15`), CH16 (`CxKGj` → `Jytjq`), CH18 (`jx5Mj` → `D5Fs3`), CH20 (`RQetY` →
  `ECs6G`), CH23 (`E8zLk` → `Mb5hl`), CH24 (`X7l36` → `TtR68`), CH25 (`P0IQl` → `p1UlYz`), CH26 (`T7owNM` → `wdu3Q`),
  CH27 (`zEbll` → `k6kVVU`), CH28 (`zeg4O` → `E1Dqu`), CH29 (`cn0Oc` → `iI37y`), CH31 (`rYdaP` → `FJcFm`), CH32
  (`IIfyy` → `t3av7`), CH33 (`rXap7` → `lJiT7`), CH34 (`jnxyz` → `E3wbcj`), CH35 (`vYth5` → `cXzhm`), CH36 (`vVaKr` →
  `sGpYU`), CH40 (`Tgokj` → `sksad`), CH41 (`dtsos` → `cRcIy`), CH64 (`fYr9B` → `y8Nx7`), CH65 (`REu4k` → `qPMtW`).
- [x] `Repository / Header · Commits`, untracked (book-marked icon, "nuxt/nuxt", `Chip not tracked` shown, no counts,
  Workflows hidden): CH10 (`xlWTI` → `fcHgt`), CH11 (`MaEZs` → `dTt55`), CH44 (`a4d3o4` → `TPED6`), CH45 (`nj2Ys` →
  `fVU8w`), CH17 (`YWD0D` → `K7Lq0`).
- [x] CH39 (`o8UQB0` → `vGzR2`): `Repository / Header · Commits`, book-marked icon, "mlaine/mdlint".
- [x] CH38 (`Fi7rx` → `T6OKog`): `Repository / Header · Commits`, "fitloop/brand-assets", `Branches and tags` hidden.
- [x] CH22 (`P4BGM1` → `Qv1Re`): `Repository / Header`, "fitloop/webapp", Issues current 118, Pull requests 24,
  Workflows 2.
- [x] CH37 (`U4pHX` → `aBTdN`): `Repository / Header`, book-marked icon, "nuxt/nuxt", `Chip not tracked` shown, Issues
  current and Pull requests without counts, Commits, Workflows hidden, `Right part` hidden.

## Round 5 · agent brief · the desktop sidebar stops expanding

Asked (`.context/sidebar-expand-mobile-only-brief.md`, not committed; PR #338): the owner, after trying it, "I don't
like the expanding on the desktop — make it only for the sidebar on mobile" (git-client D27). On a computer the open
place's row is the current one with nothing under it; the header's tabs move between its sections or views. The phone's
places panel is unchanged.

Changed: the two expanded-place sidebars show a plain current row, which reaches every desktop screen drawing them; CH71
and the desktop sub-row components are deleted; captions and notes no longer say the desktop sidebar expands.

Left for the owner:

- On a narrow computer window D13 folds a project's views into the dropdown, which has no "changed here" dot; the
  sidebar's sub-row used to carry it there. The built `HeaderTabs` menu has none either. Adding the dot to
  `Tabs / dropdown` and the menu would be a new decision, not drawn.

- [x] `Sidebar / expanded · repository open` (`DhmYq`): `Place fitloop/webapp, open` (`elBja`, the row and four
  sub-rows) → one current row `Nav fitloop/webapp` (`aONzF`): fill `$bg-3`, icon and label `$fg` 500, as the other
  current rows. Reaches CH72, CH73, CH74, R4 and CH83.

- [x] `Sidebar / expanded · project open` (`Aztvq`): `Place Platform Q4, open` (`s7uqH`, the row and five view
  sub-rows) → one current row `Nav Platform Q4` (`EAEHN`). Reaches D12, D13, D17 and R5.

- [x] CH73's sidebar (`vZN70` → `xKgNt`) and R4's (`rj2Hl` → `nyhAl`): new plain `DhmYq` instances, without their
  sub-row overrides (Issues current).

- [x] Deleted `Slot · CH71 · An indent with a thin guide line` (`rJsYu`). CH71 is not reused.

- [x] `Row of screens · The header tabs and the sub-rows` (`SN2Eo`) → `Row of screens · The header tabs`.

- [x] Deleted `Sidebar / sub-row` (`FueBC`), `Sidebar / sub-row · current` (`IuMvE`) and their holder `Sidebar
  sub-rows` (`fTxvB`) in `Parts · navigation in the sidebar`: nothing used them.

- [x] App · Repository group title (`F2Chi`): "…, under it in the sidebar" → "The repository's navigation: its row
  current in the sidebar, its sections in the header".

- [x] App · Project group title (`n7sYVu`): "…, under it in the sidebar" → "The project's views: its row current in the
  sidebar, its views in the header".

- [x] Notes `t9fdJ`, `lNXwe` (App · Repository), `vKYzC` (App · Project), `AvRbJ` (App · Commits): on a computer the
  open place's row is current and the header's tabs move between its sections or views; only the phone's places panel
  expands a place (MB270, MB271).

- [x] Captions CH72 (`p4gMfd`), CH73 (`SVwD8`), CH74 (`Ju0Ra`), D12 (`B1Gtz`), D13 (`owJqP`), D14 (`MJS6F`): the
  place's row current in the sidebar instead of expanded; D13's "Changed here gives way to the view's dot in the
  sidebar" → "Changed here gives way. The sidebar keeps Platform Q4 current."

- [x] W3a caption (`bBxmR`): "under the repository in the sidebar (App · Repository, CH72)" → "in the header's tabs
  (CH72) and, on a phone, under the repository in the places panel (MB270)".

- [x] CH80 caption (`WTLo1`): Animations turns off the sliding of a place's rows in the phone's places panel.
