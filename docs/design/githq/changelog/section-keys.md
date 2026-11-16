# A place's sections and views by key, and the remaining headers

A project's saved views get keys like a repository's sections: the first nine on `1`–`9`, shown in each view tab's
tooltip, the folded views menu and the open project's menu. `[` and `]` step to the previous and next section of a
repository or saved view of a project, taught as a footer hint in the folded tabs menu and in a list's key sheet.
Collapsing the sidebar moves from `[` to `⌘B`. The screens that still drew the header from before
`navigation-under-repo-sidebar` by hand become instances of `Repository / Header`. Base: `63577faf`.

## Round 1 · agent brief

Asked (`.context/section-keys-brief.md`, not committed): views on `1`–`9` in tooltips, the views dropdown and the
project menu; `[` `]` in the folded tabs menu and a list's help sheet; `⌘B` for the sidebar everywhere `[` was shown;
every hand-drawn pre-feature header replaced with an instance of `Repository / Header` or a variant.

Changed: two new components (a menu footer hint, a two-line tooltip), a Workflows variant of the header, 8 new screens,
31 hand-drawn headers replaced, `Repository / Header · not tracked` drawn with `Tabs / group`.

Picked by the agent, not by the brief:

- The tooltips got three screens rather than one: D14 a plain tab, D15 the cloud ("Answered by GitHub"), D16 the dot
  ("Changed here"). The dot is on Current sprint, the current view, as in D12, so D16's tooltip sits on the current
  tab and reads "Go to Current sprint" like any other tab.
- The second tooltip line needed its own component, `Tooltip / two lines`: `Diff / Comment button · tooltip` is one
  horizontal line and an instance can't change layout.
- The footer hint is a component, `Menu / key hint`, a row of `[` `]` key caps and a dimmer label, used by CH82 and
  D17. It is not an item: the caption says the cursor skips it.
- R5 is built from D12 (project open in the sidebar, the `Project pane / List` title button filled `$sel`) with R2's
  menu: Open removed and the five views added as `Menu / item · key`, as R4 did for a repository. R2's `New issue`
  row was filled `$sel` (hovered); in R5 it is transparent so only the current view is highlighted.
- The rail's expand button got its tooltip too (CH84, "Expand sidebar" `⌘B`), since `⌘B` toggles both ways.
- The only list key sheet drawn is CH30 (Commits' keys), so it got the `[` `]` row. W0's `Keys` card is a failed
  run's, not a list's; only its sentence about `[` changed.
- The header replacements keep the component's right part on Issues and Pull requests (Open, Group, Order,
  Properties, List / Board, Display), with the screen's Group label: the drawn Filter tool and GitHub icon go, as CH22
  did in the last round. Commits screens with the desktop worktree tool (CD2–CD7) replace the Commits variant's right
  part with the worktree or "Add a local clone" tool, Branches and tags with `B`, and the GitHub button. Workflows
  screens replace the variant's right part with their own key hints when they differ from Open and Other runs, and
  hide it where they had none.
- The tab counts on each replaced header are the drawn ones: "–" where Workflows wasn't read, no count where the
  drawing hid it (W14, W3d, ES14, ES16).

Left for the owner:

- A project with ten or more views: the dropdown and the project menu show no key for the tenth, but no screen draws
  one.
- CD3's worktree menu is positioned by hand under the worktree tool; it still lines up after the swap, but it isn't
  attached to the header.

### Components

- [ ] App · Components › Atoms › `Tab group and section menu` (`YZ3kQ`): new `Menu / key hint` (`b8M2LD`): `Keys`
  (`mCKPy`, `Kbd [` `aO3t3`, `Kbd ]` `fJzLm`) and `Label` (`FtONc`, `$fg-dim`, 12) "Previous / next section".
- [ ] Same row: new `Tooltip / two lines` (`DFz9W`), styled as `Diff / Comment button · tooltip`, vertical: `Line 1`
  (`Od0Ae`: `Text` `J6xWr`, `Kbd` `baedP`) and `Note` (`UdHw0`, `$fg-2`, 11.5).
- [ ] Components · Repository › `Repository headers` (`J9yf6P`): new `Repository / Header · Workflows` (`OAqIx`), an
  instance of `Repository / Header`: "fitloop/webapp", Issues 118, Pull requests 24 (`JbSgT`), Commits, Workflows
  current with 2 (`QIt1f`); `Right part` replaced by `yiQqs` with `Hint Open` ↵ and `Hint Other runs` →.
- [ ] `Repository / Header · not tracked` (`tb2FD`): `Sections` (`vx8Vz`, three `View tab`s) → `Tabs` (`v91JC`,
  `Tabs / group`): Issues current, Pull requests, Commits, no counts. J5, J6 and E6 follow.
- [ ] J7's header (`v0HUZ`) and ES17's (`ftc6r`): their override hiding `vx8Vz` went with the node; re-applied to
  `v91JC`.

### New screens

- [ ] App · Project › `Row of screens · Navigation in the sidebar` (`G6OEJ5`): new `Slot · D14 · A view's tab names
  its key` (`Yid9r`, screen `BdNps`), `Slot · D15 · A view GitHub answers says so under its key` (`a3qRZ`, screen
  `ENjTW`), `Slot · D16 · A view changed here says so under its key` (`YPzmn`, screen `dyn9S`), between D12 and D13.
  Each is D12's `Project pane / List` cropped to 160 px with a tooltip under the hovered tab: "Go to Backlog" `2`; "Go
  to Next sprint" `3` / "Answered by GitHub"; "Go to Current sprint" `1` / "Changed here".
- [ ] Same row, after D13: `Slot · D17 · The views dropdown · every view's key, and [ ] to step` (`X5XVF`, screen
  `DVIaf`), copied from D13. Its `Views menu` (`TU8tK`) shows the key caps 1–5 and ends in a `Separator` and `Menu /
  key hint` "Previous / next view" (`q8Fw6p`).
- [ ] App · Toolbar (`xFD8r`): new `State · CH82 · 3 · The dropdown open · [ ] to step` (`gruX1`) after CH78, copied
  from it. Its `Section menu` (`q0NnF`) ends in a `Separator` and `Menu / key hint` "Previous / next section"
  (`zqicE`).
- [ ] App · Repository and project menu › `Row of screens` (`H5RBK`): new `Slot · R5 · The project menu · its views
  with their keys, no Open` (`Vhg9Z`, screen `Kldir`) after R3: D12 with the title button `$sel` and R2's menu
  (`IE7CI`) without Open, the views Current sprint (checked) `1`, Backlog `2`, Next sprint (cloud) `3`, By assignee
  `4`, Bugs `5`, then New issue `C`, Open on GitHub, Copy link, Stop tracking.
- [ ] App · Repository › `Row of screens · The header tabs and the sub-rows` (`SN2Eo`): new `Slot · CH83 · Collapse
  sidebar · ⌘B in its tooltip` (`sj4ug`, screen `f5FlPp`): `Sidebar / expanded · repository open`, the collapse button
  hovered, tooltip "Collapse sidebar" `⌘B`. New `Slot · CH84 · Expand sidebar · the rail's button, ⌘B` (`T6TBYr`,
  screen `W1Cxyn`): `Sidebar / collapsed`, tooltip "Expand sidebar" `⌘B` to the button's right.

### `[` `]` and `⌘B` in existing screens

- [ ] App · Commits, CH30 (`jLbj0`): new row `Key Previous, next section` (`dQwME`) after the `1`–`4` row: `[` `]`,
  "Previous, next section", "wrapping at the ends".
- [ ] App · Command menu, E1 › `Result Collapse sidebar` (`DZYCs`): `Kbd [` (`uzd1W`) → `Kbd ⌘B`, "⌘B".
- [ ] App · Command menu, E6's `Command menu` (`F1thkx`): override `G2VaU/py3B3/luKkY` "[" → "⌘B".
- [ ] App · Workflows, W0's `Keys` note (`ejq0r`): "[ keeps collapsing the sidebar…" → "⌘B keeps collapsing the
  sidebar…".
- [ ] D13 caption note (`owJqP`): "and no keys yet (proposed: 1–9, like a repository's sections)" → "and no keys
  here: D17 is the same menu with the views' keys, 1–9, and the [ ] hint".

### Hand-drawn headers → instances

Each `Header` frame (icon outside the title, "private" or "public", separate `View tab`s) → an instance named `Header`,
fill width, overriding only the title, icon, tabs and the right part. Other content unchanged.

- [ ] `Repository / Header`: CH1 (`J5jMN` → `Q6mmC`, Issues current), CH2 (`JR2cD` → `uQ2Lk`, Group: Review), ES9
  (`P31RM` → `TNVa4`), ES10 (`K2HQn` → `bYQCy`), ES15 (`pf91H` → `Tg3LL`), ES14 (`sDMer` → `iBwpm`, Issues without a
  count), ES16 (`OFHOG` → `HFz80`, Issues without a count).
- [ ] `Repository / Header · Commits`, no overrides: ES21 (`hGScI` → `UiyHO`), ES22 (`DwM2O` → `qBrEe`).
- [ ] `Repository / Header · Commits`, `Right part` with the worktree tool: CD2 (`h6ATM` → `mnvEg`), CD3 (`f0yRB` →
  `jNTI7`), CD5 (`OwmXR` → `hSdJL`), CD7 (`lfawu` → `CTTeE`); with "Add a local clone": CD4 (`iZnUl` → `b3sV1`),
  CD6 (`E4aGX` → `jxy90`).
- [ ] `Repository / Header · Workflows` with its default hints: W3a (`hQF7O` → `d5S33O`), W3c (`g8ewF` → `YXudv`,
  Workflows "–"), W13 (`m5Iek` → `L9gQ3`, Workflows 1), W14 (`vTq6F` → `mHseq`, Workflows without a count), W17
  (`YImlz` → `pvLQg`, "fitloop/api" 71, 25, "–").
- [ ] `Repository / Header · Workflows`, its own hints in `Right part`: W3b (`K3tgK` → `hInyk`), W18 (`gBLSp` →
  `fqBDp`), W19 (`X7Inr` → `Q61yl`), W35 (`JVf4v` → `D9UB2k`), W47 (`E2tOTQ` → `BRf7n`), W48 (`Sz6LH` → `y7xdxG`),
  and the component `Workflow / List pane · narrow` (`jDNDg` → `eA302`, hints hidden as drawn).
- [ ] `Repository / Header · Workflows`, `Right part` hidden: W16 (`XEKyg` → `eys9L`, book-marked "mlaine/tasklet"
  15, 3, "–"), W3d (`PPasW` → `c2Zp19`, the same, Workflows without a count), W3e (`L9kueC` → `U4uAYw`, "fitloop/api"
  71, 25, "–"), ES27 (`Ipxwn` → `IEdRU`, as W16).

### Canvas

- [ ] App · Project (`JCfIb`) grew by 5372 px. App · Repository (`N1wdc`), App · Issue and App · Pull request
  (`XN8vf`) moved 5372 px right.
