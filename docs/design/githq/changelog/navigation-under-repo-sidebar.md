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

- [ ] App · Components › Atoms (`U5qIGb`): new row `Tab group and section menu` (`YZ3kQ`) under `Tabs`.
- [ ] `Tab / segment` (`OAxbv`): new. One tab in a group: label, plus a hidden cloud (`o6FOZ6`), count (`om1Pb`) and
  modified dot (`V8D89b`), each shown by its instances.
- [ ] `Tab / segment · with count` (`PGGNf`), `Tab / segment · current` (`rrBZ7`), `Tab / segment · with count, current`
  (`e34gBd`): new variants of `Tab / segment`. The current one is filled `$bg-3`, its label `$fg` 500.
- [ ] `Tabs / group` (`S7NcJg`): new, Variant A. A 1 px `$border` outline, radius 6, padding 2, gap 2, like the List /
  Board switch. Holds Issues, Pull requests (current), Commits, Workflows.
- [ ] `Tabs / dropdown` (`EkbKS`): new. The tabs collapsed into one menu button: icon, label, count, chevron, in a
  bordered box.
- [ ] `Menu / item · key` (`e1dJP`) and `· selected` (`zLn0z`): new. A menu row with icon, label, an optional count and
  check mark, and a key cap (`Kbd`).
- [ ] Components · Repository (`yjoY1`): new group `Parts · navigation in the sidebar` (`nktC5`).
- [ ] `Repository / Header` (`I3AnbD`): new. A `Left part` (`zvTXw`: visibility icon, title with chevron, `Tabs`, a
  hidden `Tabs dropdown`) and a `Right part` (`FPxDF`: Open, Group, Order, Properties, List / Board, Display, all
  `Repository / Tool · outline`), each filled `$bg`. The narrowing steps are instances that hide parts.
- [ ] `Sidebar / sub-row` (`FueBC`) and `· current` (`IuMvE`): new. Indented so the icon starts at the place's name
  (32 px): icon, a hidden cloud, label, a hidden modified dot, count, a hidden red broken dot.
- [ ] `Sidebar / expanded · repository open` (`DhmYq`): new instance of `Sidebar / expanded`. `fitloop/webapp`'s row is
  replaced by the place, open: the row (`$fg`, 500) and Issues 118, Pull requests 24 (current), Commits, Workflows
  (red dot, 2).
- [ ] `Sidebar / expanded · project open` (`Aztvq`): new instance of `Sidebar / expanded`. `Platform Q4` with Current
  sprint (current, dot), Backlog, Next sprint (cloud), All items, without counts.
- [ ] `Phone / Place row · group` (`dWgb5`): two hidden children added, `Modified dot` (`W1Gl4F`) and `Leaves for
  GitHub` (`K1GwWs`, ↗). Existing instances are unchanged.
- [ ] `Phone / Place row · group, current` (`QGDhI`): new variant, filled `$sel` like the current place row.
- [ ] `Phone / Places panel · a repository expanded` (`bPX1Y`) and `· a project expanded` (`LGMJ4`): new instances of
  `Phone / Places panel · in a repository`. The list sits in a clipped `Places, scrolled` frame and the flex spacer is
  hidden.

### App · Repository (`N1wdc`)

- [ ] New `Group header` (`n0B0Fm`): "The repository's navigation, under it in the sidebar".
- [ ] New `Variants · How the header tabs look` (`QVhRU`, amber): `CH67 · Variant A · One bordered group, the current
  tab filled` (`O7LAnr`, recommended), `CH68 · Variant B · An underline on the current tab, inside a bordered strip`
  (`Tyjv1`), `CH69 · Variant C · A filled pill on a subtle track, no border` (`gwlUf`). Each shows the tooltip "Go to pull
  requests `2`" (`Diff / Comment button · tooltip`). B and C replace the header's `Tabs` with a drawn strip.
- [ ] New `Variants · Sub-rows under the open place` (`D1VJC`, amber): `CH70 · Variant A · A plain indent, like My
  work's groups` (`C0DLK`, recommended) and `CH71 · Variant B · An indent with a thin guide line` (`JnliA`).
- [ ] New `Row of screens · Navigation in the sidebar` (`S6HY3`): `CH72 · Pull requests · the repository open in the
  sidebar` (`f9LyC`, copied from CH2), `CH73 · Issues · an issue open in the side panel` (`PFXUz`, copied from CH1, plus
  `Item view / stacked`, header at its last step), `CH74 · A pull request full screen · the repository stays open`
  (`z4Sz0i`, copied from F18). CH74's toolbar reads `fitloop/webapp #1228` instead of `mlaine/tasklet #15`, and so do three event numbers in its feed.
- [ ] Deleted `Row of screens · Column layout` (`QbhvI`) with `CH4 · Column layout · Issues` (`uJ21s`) and `CH5 ·
  Column layout · Pull requests` (`Cv6Pm`). Superseded by the sidebar navigation; git history keeps them.
- [ ] `Group header` (`r9nNSc`): title (`f0wCnQ`) "Two layouts of the repository view" → "The repository view's sections,
  as tabs". The note (`t9fdJ`) now says the column layout is gone and points to CH72–CH74.

### App · Commits (`DtWFt`)

- [ ] Deleted `Row of screens · Column layout` (`t6smuu`) with `CH6 · Column layout · Commits` (`oK9kd`), `CH46 ·
  Resizing the left column` (`p9NY4`) and `CH42 · Column layout · A commit's details` (`eJqeE`). CH46 drew the
  repository's column. Its resize rule for the branch and tag list moved into the note `k9veH`.
- [ ] `Group header` (`o7GlZ`): title (`LvCLp`) "1 · Commits in both layouts" → "1 · Commits in the repository's tabs".
  The note (`AvRbJ`) no longer describes the column layout.
- [ ] Note `k9veH`: "in the column layout, the column's lower part" removed. The resize rule from CH46 added (200–480
  px, 280 by default, kept on this device, gives way down to 200 px).

### App · Toolbar — view options fit, the rest go to Display (`xFD8r`)

- [ ] New `Board header · The repository header as the window narrows` (`pjYfJ`).
- [ ] New `State · CH75 · 1 · The view options in Display` (`Dm54I`, 820 px pane).
- [ ] New `State · CH76 · 2 · Display as an icon` (`YbJQ5`, 720 px), with the tooltip "Display".
- [ ] New `State · CH77 · 3 · The tabs as one dropdown` (`QBet1`, 560 px).
- [ ] New `State · CH78 · 3 · The dropdown open` (`vj5Is`, 560 px): Issues 0 `1`, Pull requests 15 `2` (checked),
  Commits `3`, Workflows 1 `4`.
- [ ] New `State · CH79 · The left part above the right` (`EYcYr`, 900 px): the left part covers the right part's
  controls that don't fit, with an annotation for each part.

### App · Repository and project menu (`pgCGV`)

- [ ] New `R4 · The repository menu · its sections with their keys, no Open` (`adcDp`), next to R1, copied from it. Open
  removed; Issues `1`, Pull requests `2`, Commits `3` (new, git-commit icon), Workflows `4` as `Menu / item · key`. The
  sidebar is `Sidebar / expanded · repository open` with Issues current, and the header is `Repository / Header` with
  the trigger filled `$sel`.

### App · Project (`JCfIb`)

- [ ] New `Group header` (`Y8musf`): "The project's views, under it in the sidebar".
- [ ] New `Row of screens · Navigation in the sidebar` (`G6OEJ5`): `D12 · Project as List · the project open in the
  sidebar` (`fSh91`). Its `Project pane / List` has the views as `Tabs / group` (Current sprint current with the dot,
  Backlog, Next sprint with the cloud, All items).
- [ ] `D13 · Project · an item in the panel, the views as a dropdown` (`r6pLoA`): the views as `Tabs / dropdown`
  (Current sprint, no count), "Changed here" and the meta text hidden, Display as an icon, its menu open (`V8fBA3`).

### App · Settings (`i3VkT`)

- [ ] New `Slot · CH80 · Settings · Display · Animations only` (`v1q8Yz`), beside CH43 and copied from it. The
  Repository layout column is removed, so only the Animations card stays.
- [ ] CH43 caption note (`yhVMR`): starts "Superseded by CH80".
- [ ] Group header notes: `h96G7` says Display holds Animations (CH80). `Vtt0e` no longer compares the settings screen
  to "the repository's column layout".

### App · Mobile (`jy6bO`)

- [ ] New `Slot · MB270 · A repository expanded in the places panel` (`INdsN`), after MB53 and copied from it: the
  banner hidden, `fitloop/webapp` expanded into Issues 118, Pull requests 24 (current), Commits ↗, Workflows ↗.
- [ ] New `Slot · MB271 · A project expanded in the places panel` (`ol6wm`): Platform Q4 expanded into its views over the
  project list (`Phone / List / Project · Current sprint`).

### Canvas

- [ ] App · States (`epLfx`), App · Freshness (`iZkBN`), App · Loading and empty states (`O6Vuj8`) and App · Toasts
  (`Sz7Bf`) moved 1520 px right. App · Settings grew by CH80 and overlapped App · States.
