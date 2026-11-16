# Retired decisions

Full text of decisions, or parts of decisions, that no longer hold, under their original IDs.

## D14

Retired 2026-11-16 in part: the two layouts and their setting gave way to the sections under the repository's row in
the sidebar, see [D25](../DECISIONS.md#d25). The sections themselves stand in [D14](../DECISIONS.md#d14).

**The repository view becomes a set of sections, Issues, Pull requests, Commits and Workflows, on `1`–`4`, each with
its own tools, in two layouts the user chooses between in Settings · Display: tabs beside the repository's name, each
with its toolbar on the same line (CH1–CH3), or a column of the repository's own beside the sidebar holding its
sections, its projects and, on Commits, the branch and tag list (CH4–CH6, CH42). … The choice is saved with the synced
settings. Both are built; after trying them the owner keeps the switch or one layout.** (2026-11-02, owner: "a very hard
decision, both are potentially good, so let's use both… a setting in our settings… synced… we'll test which is better
and either keep the switch or pick one"; the details are the design agent's)

**Why (then).** Neither shape wins on paper: tabs keep the full width for the list and the graph, the column gives the
repository a place of its own and keeps the branch list beside the graph without taking its width. Trying both in use
decides it. The layout is a preference of the user, not of a view, so it travels with the settings
([settings-sync D4](../../settings-sync/DECISIONS.md#d4)).

**Rejected (then).** Picking one layout now — owner: test both first.

## D15

Retired 2026-11-16 in part: with the column layout gone ([D25](../DECISIONS.md#d25)), the list has the one place under
the header, see [D15](../DECISIONS.md#d15).

**In the column layout it is the column's lower part on Commits (CH6). … This left column and the repository's column
are one column with one width.** (2026-11-02, design agent's proposal; the one width by the owner 2026-11-03) Why: two
layouts placing the same list on opposite sides made one of them feel wrong to the owner, and the list was the same
column in both.

Rejected then: in the column, judging the threshold on the window less the column — a threshold nobody can tell from the
window's width, for little more graph (owner, 2026-11-03).

## D22

Retired 2026-11-16 in part: the repository layout left Display with [D14](../DECISIONS.md#d14)'s layouts, see
[D22](../DECISIONS.md#d22).

**Its first setting is the repository layout of D14, two cards with a sketch of each.** (2026-11-02, CH43)

## D7

Retired 2026-11-02 in part: the replace prompt for a second clone gave way to a message, see
[D7](../DECISIONS.md#d7).

**A GitHub repository has at most one local clone in githq; parallel work goes through that clone's
worktrees. Adding a worktree's folder adds its clone (resolved with `git rev-parse --git-common-dir`);
adding a second separate clone of the same repository offers to replace the first.** (2026-11-01, owner:
"we support only one clone per repo… opinionated, but so be it"; the handling of the two add cases is the
design agent's proposal)

**Why.** With worktrees a second clone gains almost nothing, and supporting it means several sets of local
branches in one graph and a choice of clone behind every local action.

**Rejected.**

- Several clones per repository — too much complexity for too little gain (owner).

## D9

Retired 2026-11-02 in part: the REST conditional ref checks and the date gate on drawing were dropped, see
[D9](../DECISIONS.md#d9).

**History is paged and kept like this** (2026-11-01, owner asked for the caching and paging design; the
mechanism is the design agent's proposal):

- **Kept:** commits (immutable fields of [D8](#d8)) per repository in IndexedDB, for good; refs (branches and
  tags with their target oid) as last seen. Everything is a rebuildable cache, as for the rest of githq.
- **Opening a repository seen before:** draw from the cache, then check refs with REST conditional requests
  (`GET /repos/{owner}/{repo}/git/matching-refs/heads` and `…/tags` with `If-None-Match`); only if they
  changed, fetch the moved refs' new commits.
- **Opening a repository the first time:** one GraphQL request for the branches, the tags and the default
  branch's first 100 commits; draw them. Then, for every branch tip not among known commits, fetch
  `history(first: 20)` in one batched request, and repeat deeper only for branches still not joined to known
  commits.
- **Scrolling down:** the frontier is the set of parents of loaded commits that are not loaded themselves;
  fetch `history(first: 100)` from the newest frontier commit and drop commits already known.
- **What is drawn:** rows ordered by committer date across all refs (`git log --date-order`), down to the
  newest date any loaded branch's frontier has reached — never past it, so a commit loaded later can never
  appear above rows already shown.

**Why.** It keeps every open after the first one free of network waits and costs nothing when nothing moved;
a first open shows rows after one request of about a second.

> **Checked 2026-11-01:** measured with `gh api`:
>
> - branches and tags (`refs(first: 100)` twice, oids only): cost 1, 0.83–0.86 s on `nuxt/nuxt` (67 branches,
>   339 tags, so tags need paging), 0.49–0.82 s on `kedrzu/githq`;
> - 100 branches × `history(first: 20)` in one request on `nuxt/nuxt`: cost 21, 3.06 s — the reason to fetch
>   only branches that are not yet joined;
> - `GET repos/nuxt/nuxt/git/matching-refs/heads` repeated with its `ETag` in `If-None-Match`: `304 Not
>   Modified`.
>
> Size: a page of 100 commits with the fields of D8 was 30.5 kB of JSON, about 300 bytes a commit, so even
> 30,000 commits fully scrolled would be roughly 9 MB (estimate from that one measurement).

**Rejected.**

- Fetching the whole history on first open — seconds to minutes for a large repository, for rows nobody
  scrolls to.
- Fetching every branch's history up front, joined or not — cost and latency grow with the branch count
  (21 points and 3 s for 100 branches) for branches that mostly share the default branch's history.
- Drawing commits as they arrive regardless of other branches' depth — rows would jump as later branches
  load.

## D17

Retired 2026-11-03 in part: the narrowest graph is two lanes, not one, see [D17](../DECISIONS.md#d17).

**A divider between the graph and the rows can be dragged. By default the graph takes a tenth of the pane's width;
dragged, it can go from one lane (the default branch alone) to every lane. Lanes that don't fit fold into one thicker
line at the graph's right edge, and their commits sit on it.** (2026-11-02, owner)

## D15

Retired 2026-11-03 in part: the list is on the left in both layouts, one column with one width, see
[D15](../DECISIONS.md#d15).

**The branch and tag list sits to the right of the graph, always there on a wide window; below about 1,200 px it folds
away and `B` opens it over the graph.** (2026-11-02, design agent's proposal) Why it was on the right: it leaves the app's
sidebar and the graph's left edge alone.

## D16

Retired 2026-11-15: a commit opens as an item, in the shared panel or on its page, see [D16](../DECISIONS.md#d16).

**A commit's details show in a panel, never as a modal or a page, and the selection shows them: the panel is open from the
moment the section opens, on the selected commit, which starts as the newest commit of the default branch, or the top row
when that one is not loaded. `J`, `K` and a click move through the graph and it follows; `P` goes to the first parent, `⇧P`
to the second of a merge, `⇧↵` opens the commit's pull request as any item opens, `O` opens it on GitHub. `Esc` closes it and
the next move shows it again, as does `↵`; a row disappearing is not a move. `B` goes to the list's filter and the panel
stays. On a wide window the panel is on the right of the graph with the list staying on its left, in both layouts: 440 px by
default, its left edge dragged or moved with `←`/`→` from 320 px to what leaves the graph 240 px, kept on the device under
its own name, and giving up width where the graph would have under 240 px. Below about 1,200 px of window, one threshold in
both layouts, it sits under the graph at the pane's full width and a fixed 45% of the height (CH48); the list over the graph
covers the graph only.** (2026-11-02, design agent's proposal, owner picked the panel over the modal; CH18, CH20, CH27–CH29,
CH42; on the right with the list staying by the owner 2026-11-03; following the selection, the default branch's start, `Esc`,
the width and the place under the graph by the owner 2026-11-03, the numbers the agent's)

**Why (then).** A commit is not an item: nothing in it is edited or commented, and it is read against the graph beside
it, which a modal or a page would hide.

## D16

Retired 2026-11-03 in part: the details open on the right of the graph with the list staying, see
[D16](../DECISIONS.md#d16).

**A commit's details open only in a panel, in the place of the branch and tag list, never as a modal or a page. `Esc`
closes and the list comes back.** (2026-11-02, design agent's proposal, owner picked the panel over the modal)

Retired 2026-11-03 in part: the details no longer wait for `↵` nor open over the graph on a narrow window, see
[D16](../DECISIONS.md#d16). Until then:

**The panel opens on `↵`. Below about 1,200 px of window it opens over the graph from the right; in the tabs layout the
list and the panel are then one at a time. On a wide window the panel is a fixed 440 px, giving up width where the graph
would have under 240 px.** (2026-11-03, owner)

## D25

Retired 2026-11-16 in part: on a computer the open place no longer expands in the sidebar, see [D27](../DECISIONS.md#d27).
The header, the tabs and the menus stand in [D25](../DECISIONS.md#d25).

**The repository's own column and the setting that chose it go. While a tracked repository is the open place, its
sections show under its row in the app's sidebar, with the counts its tabs show: open issues, open pull requests, none
for Commits, Workflows its broken ones, a dash while that is unknown; Workflows only while it is tracked. They slide open
and closed unless Settings · Animations is off. The header keeps the tabs while they fit, drawn as one bordered group
with the current tab filled (CH67), each with a tooltip naming where it goes and its key ("Go to issues" `1`). As room
runs out the header gives way in steps: the view options move into Display, Display drops its label for its icon, the
tabs fold into one menu showing the current section, last the title is cut. The repository's visibility is a book or a
lock inside the title's button, read out as public or private, no longer a word beside the name (CH72). The repository's
menu, its title's and the sidebar's, drops Open and lists Issues, Pull requests, Commits and Workflows, their keys `1`–`4`
shown on the open repository's menu only. A tracked project's saved views follow the same model: under its row in the
sidebar, in the same tab group, folding the same way, with no counts.** (2026-11-16, owner: the column takes a third of a
small screen and repeats the repository's name, the tabs neither read as tabs nor hint at their keys, a narrow header has
nowhere to go; picked CH67 and the sub-rows' guide line, CH71; the title's icon "isn't clickable, is a bit too big and
too far from the repository's name"; a project's views without counts, "as its tabs have none". CH72–CH80)

**Why (then).** The sidebar already lists the repository, so its sections nest under its row at no width of their own, and the
list and the graph keep the window. Only the open place expands, so the sidebar stays a list of places. Tooltips teach
the keys the tabs never showed. Giving way in steps keeps every control reachable at any width; the header's left part
paints over the controls, so one that doesn't fit is covered, never drawn under the title. On another repository's menu
the keys would do nothing, so they would lie.

**Rejected (then).**

- Keeping the column beside the tabs behind a setting ([D14](../DECISIONS.md#d14)'s two layouts,
  [history](#d14)) — it takes a third of a small screen and repeats the repository's name (owner).
- The current tab underlined inside a bordered strip (CH68), or a filled pill on a track with no border (CH69) — owner
  picked CH67, the List / Board switch's look.
- Sub-rows as a plain indent, like My work's groups (CH70) — owner picked the thin guide line (CH71).
- A marker on the collapsed sidebar for the open repository — the rail lists no repositories; there the header is the way
  around.
