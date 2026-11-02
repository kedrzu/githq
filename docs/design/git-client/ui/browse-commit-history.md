# Browsing a repository's commit history

## Purpose

githq shows a repository's issues and pull requests, but not its code history. This path adds the history as a
commit graph with its branches and tags, the kind of view a desktop git client opens on, with one thing such a
client cannot show: next to each commit, the pull request it came from and the state of its CI. There are no files
and no diffs yet. The user arrives from a repository's view, which they reach from the sidebar, the command menu
or a link to one of its pull requests, possibly in a repository githq does not track.

This is the first step towards one fast app for git, GitHub, review and tasks. Later, in the desktop app only, the
same view also shows the user's local clone.

## The user's task

"Show me what is happening in this repository: where its branches stand, what landed and through which pull
request, what is red, and let me get to any commit from there." It is a look around, often quick, usually between
other things, and all of it from the keyboard.

## Screens, in order

1. **The repository view, with Commits among its sections.** Today this view has tabs beside its title (All, Issues,
   Pull requests) that only filter one list, plus a toolbar for that list: state, grouping, List or Board. None of
   those controls mean anything for commits, and the owner wants anything no longer needed removed. The view has to
   become a set of sections with their own tools. This is the screen with the most open shape; see the questions at
   the end.
2. **The graph.** It answers: *where do things stand, and what happened recently?*
3. **The list of branches and tags beside the graph.** It answers: *where is this branch or tag?* Choosing one
   scrolls the graph to the commit it points at, and does not narrow the graph to that branch.
4. **A commit's details.** They answer: *what is this commit, and how did it get here?*
5. **Second step, desktop only: the same view with a local clone added.** See below. It is drawn now so that the
   first version's layout is known to hold it; it is built later.

## What's on each screen

**A row of the graph**, by importance:

- Its place in the graph: the lines of the branches running through it, and whether it is a merge. A commit
  usually has one or two parents, rarely more, and the first commit of a history has none.
- The first line of its message.
- The branches and tags pointing at it. Several can point at one commit, and a tip of a branch usually carries
  its name only there.
- The pull request it came from, with its number and state (open, merged, closed). Many commits have none, such as
  those pushed directly, and that is ordinary rather than a problem.
- The state of its CI: passing, failing, running, or no checks at all, which is common.
- Author and date.

**The branch and tag list:** every branch and every tag of the repository on GitHub, with the default branch easy to
find. A real repository has dozens of branches and hundreds of tags (`nuxt/nuxt` has 67 and 339), so finding one by
typing matters. This is a look at GitHub's branches, so on the web there are no local branches here.

**A commit's details:** the full message, the author, its parents (each a way to that commit), the branches and tags
pointing at it, its pull request and CI state, and a way to open it on GitHub with `O`, as elsewhere. Nothing about
files. From here a pull request opens as any item does.

**Second step, desktop only.** The user adds the folder of a clone once; a repository has at most one clone in githq.
That brings:

- the clone's local branches in the graph and the list, and how far they are ahead of GitHub;
- its worktrees: separate working copies of one clone, each with its own checked-out branch and uncommitted
  changes. The owner typically has several, each with an agent working in it. Each shows as a marker at the commit it
  has checked out, with its count of uncommitted changes, and on its branch in the list. It is the most valuable
  thing in this view on the desktop: where each agent stands;
- actions on a worktree from either place, for a start revealing its folder in Finder (or the platform's file
  manager). This list of actions will grow, so it should be a place that can.

A worktree can have no branch at all, checked out on a bare commit, so it has nothing to sit on in a list of branches.

## States

- **Opened before:** the graph is there at once, from the copy kept in the browser, and updates in the background. This
  is the usual case, with no loading state to see.
- **First open of a repository:** nothing is kept yet. About a second until the first hundred commits of the default
  branch and all branches and tags arrive, in one go. Then other branches fill in over a few seconds, so commits
  appear between rows already on screen. The user should not take that for something having changed.
- **Pull request and CI state arriving:** about a second after the rows, fetched only for rows on screen, and again as
  rows scroll into view. The rows are readable without them, and "not known yet" must not read as "has none".
- **Scrolling past what is loaded:** about a second for the next hundred. Reaching the first commit of the repository
  is the real end of the graph.
- **A branch or tag whose commit is not loaded,** such as an old tag: choosing it opens that commit's details instead
  of scrolling, because reaching it could take dozens of requests. The user should understand why the graph did not
  move.
- **An untracked repository:** Commits works in full. Today this view explains the repository isn't tracked and offers
  to track it. That explanation is about issues and pull requests, and must not read as applying to commits.
- **Empty repository, or one with a single branch and no tags.** A straight line of commits is a common and legitimate
  graph.
- **Offline, requests failing, or refresh paused by the API allowance:** what is kept stays visible and usable, as with
  freshness in the rest of the app. Rows not yet loaded and pull request or CI state not yet known cannot appear.

## Failures that must be visible

- A commit whose CI is failing has to stand out while scanning, since it is the main reason to prefer this to a plain
  git client.
- A branch that disappeared or moved on GitHub since it was kept (force-pushed, deleted): the graph corrects itself, and
  a commit no longer on any branch must not leave the user looking at something that isn't there.
- **Second step:** a clone whose `origin` matches no tracked repository, and adding a second clone of a repository that
  already has one, which is refused with a message naming the folder already added and a way to remove it. Adding the
  folder of a worktree simply adds its clone, with no question asked.

## Technical constraints

- Commits never change; everything about them is available at once when kept. Pull request and CI state do change, and
  are fetched separately for rows on screen.
- A row can show one pull request.
- Rows are ordered by date across all branches. There is no fetching ahead of scrolling, and no total count of commits to
  rely on across branches.
- Branches and tags are checked when the tab opens, not continuously, so what is on screen can be a little behind.
- The whole list of branches and tags is known from the start, while commits are not.
- Nothing can be written to the repository: no commit, fetch, push, or creating a branch, on the web or the desktop, in
  either step. Don't draw controls for them.
- A graph line's layout is computed from the commits loaded so far, and a repository can have many branches side by side.

## Questions this design should settle

1. **The shape of the repository view.** Today's tabs filter one list, while Commits is a different kind of content. How do
   issues, pull requests and commits sit together, what happens to All, Issues and Pull requests, and what is removed? The owner
   asked for several directions to choose from.
2. **Where the branch and tag list lives,** given that the app already has a sidebar, and whether it is always there.
3. **How a commit's details open.** Items open in a panel, a modal or a full page. Is a commit that kind of thing, and
   how do `J` and `K` move from commit to commit with its details open?
4. **How much graph width a row gives up,** when a repository has many parallel branches and the message has to stay readable.
5. **How branches, tags, pull request and CI state fit on one row** without becoming noisy, in a calm, dense list.
6. **The keys:** moving through rows, reaching the branch list, jumping to a branch by name, jumping to parents, switching section.
7. **Second step:** whether worktrees also get a section of their own in the list, which would give a worktree with no branch
   a place. The design agent's earlier suggestion was yes; the owner has not settled it.

## The screens

In `githq.pen`, frames **"App · Commits"** (`DtWFt`) and **"Desktop · Commits"** (`Ri8IR`); the two layouts with Issues and Pull
requests (CH1, CH2, CH4, CH5) are in **"App · Repository"** (`N1wdc`), and Settings · Display (CH43) in **"App · Settings"**
(`i3VkT`). The numbers are the frames'.
Amber frames are still to be picked; Variant A of each is recommended. Screens outside section 1 are drawn in the tabs layout. Decisions: [DECISIONS](../DECISIONS.md), D14 onward.

|Question|Answer in the frame|
|-|-|
|1. The shape of the repository view|Sections on `1`–`4`, All removed, in two layouts chosen in Settings · Display (CH43): tabs, CH1–CH3; a column of the repository's own, CH4–CH6, CH42. Both are built and tried; the Work and Code shape was dropped (D14, D22)|
|2. Where the branch and tag list lives|Tabs layout: a column right of the graph, always there on a wide window: CH3, CH15–CH17. Column layout: the lower part of the repository's column: CH6 (D15)|
|3. How a commit's details open|Only in a panel, in the list's place; `J`/`K` keep moving and the panel follows: CH18; a merge: CH20; in the column layout, on the right of the pane: CH42 (D16)|
|4. How much graph width a row gives up|A draggable divider, a tenth of the pane by default, lanes that don't fit fold: CH10; wide CH11; narrow CH44; dragging CH45 (D17)|
|5. Branches, tags, pull request and CI on one row|Refs before the headline, pull request and CI right after it, author and age at the right, a faint stripe; a failure is a red dot and a red ✕: CH12 (D18)|
|6. The keys|`1`–`4` sections, `J`/`K` rows, `B` the list, `↵` details, `P`/`⇧P` parents, `⇧↵` pull request, `O`, `Esc`: CH30; the walk CH22–CH29|
|7. A Worktrees section in the list|Yes, above the branches: CD1; worktrees on their branches only: CD2 (D21)|

The repository view: CH1–CH3 and CH4–CH6, the setting CH43. The graph: few branches CH3, many CH10. The list: CH15–CH17. A
commit's details: CH18, CH20. Desktop second step: CD1, worktree actions CD3, adding a folder CD4, CD5.

States: opened before CH31; first open, the first second CH32, branches filling in CH33; pull request and CI not known yet CH34;
scrolling past what is loaded CH35; the beginning of the history CH36; an old tag not loaded CH16; untracked CH37 (Issues) and CH10,
CH17 (Commits); empty CH38; one branch and no pull requests CH39; offline CH40. Failures: failing CI CH12; a branch force-pushed or
deleted CH41; no tracked repository for a folder CD6; a second clone CD7.

Still open, not settled by the screens:

- **Which layout stays (D14)** is decided by trying both; **every amber variant** waits for the owner.
- **Settings sync's D7** lists only what is tracked as synced; the repository layout is the first other synced setting, and that
  design's decisions should say so.
- **Data the screens need that [D8](../DECISIONS.md#d8) and [D9](../DECISIONS.md#d9) don't fetch yet:**
  - the pull request and CI of each branch's tip in the list (CH3): the rows on screen in the list need the same
    `nodes(ids:)` request as the graph's rows, or a tracked repository's pull requests by head branch;
  - "newest first" for branches: GitHub orders refs only by name (tags alone by date), so the refs request needs each
    tip's `committedDate` and a local sort (D15);
  - the commit's details show CI as the rollup only (CH18); naming the failing checks would need
    `statusCheckRollup.contexts`, which nothing fetches. The details point to GitHub instead.
- **A clone of an untracked repository (CD6).** [D5](../DECISIONS.md#d5) matches a folder to a tracked repository only,
  while [D11](../DECISIONS.md#d11) lets Commits work without tracking. CD6 follows D5 and offers to track; the owner may
  prefer to add the clone to the untracked repository's Commits.
- **Workflows in an untracked repository** (the section is drawn in CH10, CH37): the actions design doesn't say whether it
  works there.
- **The pull request opened from a commit (CH29)** uses the shared pull request panel unchanged; its content is the
  component's sample, not #1228's.
