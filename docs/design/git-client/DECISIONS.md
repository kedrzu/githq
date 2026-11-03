# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the decision's ID alone,
so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired decisions, the journal and notes
from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history they link to.**
Reopening a rejected option is right when its premise changed; repeating it without knowing it was rejected is
not.

## D1

**The web app draws the commit graph from GitHub's API (refs plus commit history with parents), cached in
IndexedDB like all other GitHub data; it keeps no git clone of the repository. The desktop app draws the same
graph, and overlays what only a local clone knows.** (2026-11-01, proposal of the design agent, not yet
confirmed by the owner)

**Why.** The graph needs only commits, their parents and refs, all of which GitHub's GraphQL API returns
(`Repository.refs`, `Ref.target`, `Commit.history`, `Commit.parents`). Commits are immutable, so a cached commit
never has to be fetched again; only refs need change detection. A browser clone would add nothing GitHub's API
does not already show, because it is a copy of the remote, not of the user's local work.

> **Checked 2026-11-01:** github.com's smart HTTP endpoint answers
> `GET https://github.com/isomorphic-git/isomorphic-git.git/info/refs?service=git-upload-pack` with
> `Origin: https://githq.dev` without any `Access-Control-Allow-Origin` header, and the CORS preflight
> (`OPTIONS`) with `405`. isomorphic-git's own docs route browser clones through a CORS proxy for this reason
> ([quickstart](https://isomorphic-git.org/docs/en/quickstart): "GitHub hasn't added CORS headers to the git
> clone endpoint yet, we have to use a proxy server").

> **Checked 2026-11-01:** GraphQL `Commit.history` is "the linear commit history starting from (and including)
> this commit, in the same order as git log", paginated, with `since`/`until`/`path`/`author` filters;
> `Commit.parents` is a connection; `Ref.target` resolves to a `Commit` or an annotated `Tag`
> ([commits](https://docs.github.com/en/graphql/reference/commits), [git](https://docs.github.com/en/graphql/reference/git)).

**Rejected.**

- A git clone in the browser (isomorphic-git over OPFS or IndexedDB) to give web and desktop one code path —
  every clone and fetch would stream through a proxy on our Worker, putting repository contents and the user's
  token through our server, and the result still holds nothing that is not on GitHub.
- Opening the user's real local clone in the browser through the File System Access API — Chromium only, no
  SSH or credential helpers, no hooks; the desktop app does this properly.

## D2

**The desktop app reads and writes local repositories by running the system `git` CLI.** (2026-11-01, owner:
"rather yes" to the design agent's proposal)

**Why.** It is the user's own git, with their SSH keys, credential helpers, hooks, configuration, and full
worktree support, so anything githq does behaves exactly like the same command in the terminal.

**Rejected.**

- An embedded library (libgit2 through `git2`, or gitoxide) in the Tauri backend — a second git implementation
  that can disagree with the user's configuration, hooks and credentials, and lags behind git on newer
  features such as worktrees. Would win if spawning `git` turned out too slow for reading the graph; then a
  library could serve reads only.

## D3

**The commit graph is per repository. There is no cross-repository view of branches.** (2026-11-01, owner:
"I don't see the point of branches across all repositories")

**Why.** A graph is a property of one repository; the cross-repository views githq already has (your pull
requests, your reviews) cover the work across repositories.

**Rejected.**

- A view of your branches across every tracked repository — the owner sees no use for it.

## D4

**An agent orchestrator built into githq is out of scope of this design.** (2026-11-01, design agent's
proposal after the owner mentioned it as a possibility)

**Why.** It is a product of its own size; this design only has to leave room for it, not shape it.

## D5

**The desktop app knows a local clone because the user added its folder; githq matches it to a tracked GitHub
repository by its `origin` remote URL, and discovers its worktrees with `git worktree list`.** (2026-11-01,
owner: both adding and scanning are fine eventually, the simplest first; forks "as simple as possible to start")

**Why.** Adding a folder is one explicit step, needs no disk access beyond the folder, and is the simplest
thing that works. Matching by `origin` alone is the simplest rule; a fork clone whose `origin` is the user's
fork matches the fork if that is tracked, and nothing otherwise.

**Rejected.**

- Only scanning the disk for clones — slower and intrusive as the only way in; may come later next to
  adding a folder.
- Matching by any remote (so a fork clone joins the upstream repository and the graph shows both remotes) —
  more than the start needs; reopen when forks matter.

## D6

**A worktree appears in the graph as a marker at its checked-out commit, with its count of uncommitted
changes, and in the branch list on its checked-out branch; both are places to act on it, starting with
revealing its folder in the platform's file manager.** (2026-11-01, owner)

**Why.** With several agents working in worktrees at once, where each one stands is the most useful thing the
view can show, and the folder is the first thing you want to reach from it.

## D7

**A GitHub repository has at most one local clone in githq; parallel work goes through that clone's
worktrees. Adding a worktree's folder adds its clone (resolved with `git rev-parse --git-common-dir`);
adding a second separate clone of the same repository is refused with a message naming the folder already
added, and a way to remove it.** (2026-11-01, owner: "we support only one clone per repo… opinionated, but so
be it"; the refusal chosen by the owner 2026-11-02 over the design agent's replace prompt)

**Why.** With worktrees a second clone gains almost nothing, and supporting it means several sets of local
branches in one graph and a choice of clone behind every local action.

**Rejected.**

- Several clones per repository — too much complexity for too little gain (owner).
- Asking whether to replace the existing clone — a flow of its own for a case meant to be rare; removing
  and adding does the same ([history](history/DECISIONS.md#d7)).

## D8

**Commit history is fetched in pages of 100 with only immutable fields (oid, headline, author, date, parents)
and cached for good; the pull request (`associatedPullRequests(first: 1)`) and CI state
(`statusCheckRollup.state`) are fetched separately, only for the rows on screen, through `nodes(ids:)`, and
refreshed.** (2026-11-01, owner agreed to the rows carrying pull request and CI state; the split is the
design agent's proposal)

**Why.** Rate-limit points are not what separates the options: every variant costs 1–2 points of 5,000 an
hour. Latency is: adding pull request and CI state to a page of 100 commits takes it from about 1 s to
2–4 s. And the two halves have different lifetimes: commits never change, pull request and CI state do.

> **Checked 2026-11-01:** measured against `nuxt/nuxt` with `gh api graphql`, three runs each, history of the
> default branch, `first: 100`:
>
> - immutable fields only: cost 1, 0.89–1.04 s, 30.5 kB;
> - plus `statusCheckRollup { state }`: cost 1, 1.47–3.27 s;
> - plus `associatedPullRequests(first: 1) { nodes { number state } }`: cost 2, 1.74–2.84 s;
> - both: cost 2, 1.69–4.47 s, 40.4 kB;
> - pull request and CI state for 30 commits by node ID (`nodes(ids:)`): cost 1, 0.73–0.97 s.
>
> GraphQL limit for the account: 5,000 points an hour (`gh api rate_limit`).

**Rejected.**

- Fetching pull request and CI state with every page of history — two to three times slower per page, and it
  caches mutable state next to immutable commits.
- Rows without pull request and CI state — the integration with GitHub is the point of the view (owner).

## D9

**History is paged and kept like this** (2026-11-01, owner asked for the caching and paging design; the
mechanism is the design agent's proposal, simplified by the owner 2026-11-02):

- **Kept:** commits (immutable fields of [D8](#d8)) per repository in IndexedDB, for good; refs (branches and
  tags with their target oid) as last seen. Everything is a rebuildable cache, as for the rest of githq.
- **Opening a repository seen before:** draw from the cache, then fetch the refs with one GraphQL request in
  the background and compare them with the kept ones; fetch new commits only for refs that moved.
- **Opening a repository the first time:** one GraphQL request for the branches, the tags and the default
  branch's first 100 commits; draw them. Then, for every branch tip not among known commits, fetch
  `history(first: 20)` in one batched request, and repeat deeper only for branches still not joined to known
  commits.
- **Scrolling down:** the frontier is the set of parents of loaded commits that are not loaded themselves;
  fetch `history(first: 100)` from the newest frontier commit and drop commits already known.
- **What is drawn:** every loaded commit, ordered by committer date across all refs (`git log --date-order`). A commit loaded later may land between rows already on screen.

**Why.** Every open after the first draws without waiting for the network; a first open shows rows after one
request of about a second. The ref check is one request of 1 point when the tab opens, so a second code path
for free `304`s would save next to nothing.

> **Checked 2026-11-01:** measured with `gh api`:
>
> - branches and tags (`refs(first: 100)` twice, oids only): cost 1, 0.83–0.86 s on `nuxt/nuxt` (67 branches,
>   339 tags, so tags need paging), 0.49–0.82 s on `kedrzu/githq`;
> - 100 branches × `history(first: 20)` in one request on `nuxt/nuxt`: cost 21, 3.06 s — the reason to fetch
>   only branches that are not yet joined.
>
> Size: a page of 100 commits with the fields of D8 was 30.5 kB of JSON, about 300 bytes a commit, so even
> 30,000 commits fully scrolled would be roughly 9 MB (estimate from that one measurement).

**Rejected.**

- Fetching the whole history on first open — seconds to minutes for a large repository, for rows nobody
  scrolls to.
- Fetching every branch's history up front, joined or not — cost and latency grow with the branch count
  (21 points and 3 s for 100 branches) for branches that mostly share the default branch's history.
- Checking refs with REST conditional requests (`matching-refs` with `If-None-Match`, which does answer
  `304`, checked 2026-11-01) — a second code path and an ETag per page of tags, to save one point per open
  ([history](history/DECISIONS.md#d9)).
- Drawing a commit only once every branch is loaded down to its date, so rows never move — the owner chose
  the simpler drawing ([history](history/DECISIONS.md#d9)).

## D10

**Commits is a tab of the repository view, beside the repository's issues and pull requests; the repository
view is generalised from one filtered list (tabs All, Issues, Pull requests) into sections with their own
tools. Its UI is chosen from several designed directions.** (2026-11-01, owner)

**Why.** The graph is per repository ([D3](#d3)), so it belongs to the repository. The current tabs only
filter one list and its toolbar (state, grouping, board) has nothing to offer the graph.

> **Checked 2026-11-01:** the repository view's tabs are `all | issues | pullRequests` filtering one list,
> with state, grouping and List/Board in its toolbar — `packages/app/repository/RepositoryView.vue:1`,
> `:117`, `:140`.

**Rejected.**

- A separate top-level commits view outside the repository — the owner places it in the repository.

## D11

**The Commits tab works in any repository the user can see, whether githq tracks it or not.** (2026-11-01,
design agent's proposal, owner: "ok")

**Why.** Tracking exists to copy a repository's issues and pull requests in the background; the graph is
fetched only when the tab is opened ([D9](#d9)), so tracking would add nothing to it.

**Rejected.**

- Commits only in tracked repositories — a user coming from a pull request link into someone else's
  repository would have to track it to see its history, for no gain.

## D12

**Choosing a branch or tag in the list beside the graph scrolls the graph to the commit it points at when
that commit is loaded, and goes back to the graph with the filter cleared, so the next `↵` opens that commit's details
(CH26); otherwise it opens the commit's details without loading history down to it.** (2026-11-02, design agent's
proposal, owner agreed; the unloaded case chosen by the owner; going back to the graph settled by the owner 2026-11-03)

**Why.** It is the simplest behaviour that answers "where is this branch", and keeps one graph on screen.

**Rejected.**

- Staying in the list after choosing, the filter and the choice kept (the first CH15) — the next `↵` chooses the same
  ref again, so a commit's details are out of reach without `Esc` (owner, 2026-11-03).
- Narrowing the graph to the chosen branch's history — more to build and a second mode of the view; may come
  later.
- Loading history down to an old tag to scroll to it — dozens of requests for a tag years back in a large
  repository.

## D13

**A commit's details show its full message, author, parents (each navigable), the branches and tags pointing
at it, its pull request and CI state, and a link to it on GitHub — no files and no diff in the first
version.** (2026-11-02, design agent's proposal, owner agreed; "no code for now" is the owner's)

**Why.** Everything but the message's body is already fetched for the graph ([D8](#d8), [D9](#d9)); the body is one
request when the details open, kept for the session. Files and diffs are the owner's explicit "not yet". CI is the rollup
alone: no count of failing checks, nothing else fetches them.

## D14

**The repository view becomes a set of sections, Issues, Pull requests, Commits and Workflows, on `1`–`4`, each with
its own tools, in two layouts the user chooses between in Settings · Display: tabs beside the repository's name, each
with its toolbar on the same line (CH1–CH3), or a column of the repository's own beside the sidebar holding its
sections, its projects and, on Commits, the branch and tag list (CH4–CH6, CH42). In both, All is removed; Issues and
Pull requests are two lists with their own state, grouping, List or Board and Display; the open count beside the title
and grouping by kind go too. The choice is saved with the synced settings. Both are built; after trying them the owner
keeps the switch or one layout.** (2026-11-02, owner: "a very hard decision, both are potentially good, so let's use
both… a setting in our settings… synced… we'll test which is better and either keep the switch or pick one"; the
details are the design agent's)

**Why.** Neither shape wins on paper: tabs keep the full width for the list and the graph, the column gives the
repository a place of its own and keeps the branch list beside the graph without taking its width. Trying both in use
decides it. The layout is a preference of the user, not of a view, so it travels with the settings
([settings-sync D4](../settings-sync/DECISIONS.md#d4)). This adds the first synced setting beyond what is tracked, which
[settings-sync D7](../settings-sync/DECISIONS.md#d7) lists.

**Rejected.**

- Two sections, Work (issues and pull requests in one list, kind as a switch) and Code (commits, workflows) — keeps All
  but shares one grouping between issues and pull requests, and puts the branch list behind a key (owner, 2026-11-02;
  the screens were CH7–CH9 and CH21, deleted).
- Picking one layout now — owner: test both first.

## D15

**The branch and tag list sits to the right of the graph, always there on a wide window; below about 1,200 px it
folds away and `B` opens it over the graph. The default branch is first, then branches, then tags, each newest
first, with the pull request and CI of each branch's tip, the newest twenty of each drawn and the rest counted. `B` puts
the cursor in its filter, typing narrows both groups, every letter typed, and `↑`/`↓` move through the matches.**
(2026-11-02, design agent's proposal; CH3, CH15–CH17, CH6; the keys settled by the owner 2026-11-03)

**Why.** Where the branches stand is half of what the view answers, so it should not wait behind a key; on the
right it leaves the app's sidebar and the graph's left edge alone.

> **Checked 2026-11-02:** GitHub's `RefOrderField` has only `TAG_COMMIT_DATE` (tags only) and `ALPHABETICAL`
> (`gh api graphql`, `__type(name: "RefOrderField")`). "Newest first" for branches needs each tip's
> `committedDate` in the refs request of [D9](#d9) and a local sort.

In the column layout the list is the column's lower part on Commits (CH6), and a commit's details open on the right
of the pane instead of in the list's place (CH42); below the same 1,200 px of window they open over the graph, one
threshold in both layouts (owner, 2026-11-03).

**Rejected.**

- `J`/`K` through the matches (the first CH30) — in a filter they are letters, and names like `jan/x` or `k8s` must stay
  typable (owner, 2026-11-03).
- Building the list on `FilterList` — it always highlights its first row, has one message per list and a plain heading;
  extending it for this one list costs more than the keys it would share (owner, 2026-11-03).
- In the column, judging the threshold on the window less the column — a threshold nobody can tell from the window's
  width, for little more graph (owner, 2026-11-03).
- The list only on demand, as a picker over the graph (CH21, deleted with the Work and Code layout) — nothing on
  screen says where branches stand.

## D16

**A commit's details open only in a panel, in the place of the branch and tag list, never as a modal or a page.
`J` and `K` keep moving through the graph with the panel open and it follows; `P` goes to the first parent, `⇧P`
to the second of a merge, `⇧↵` opens the commit's pull request as any item opens, `O` opens it on GitHub, `Esc`
closes and the list comes back.** (2026-11-02, design agent's proposal, owner picked the panel over the modal; CH18, CH20,
CH27–CH29)

**Why.** A commit is not an item: nothing in it is edited or commented, and it is read against the graph beside
it, which a modal or a page would hide.

**Rejected.**

- The details as a modal — hides the graph that `J` and `K` move through (owner picked CH18; the modal was CH19, deleted).

## D17

**A divider between the graph and the rows can be dragged. By default the graph takes a tenth of the pane's width;
dragged, it can go from two lanes (the default branch, always the first lane, and the fold) to every lane, while the rows
keep at least 240 px. Lanes that don't fit fold into one thicker line at the graph's right edge, and their commits sit on
it. The width is a share of the pane, so it scales with the
window, and is remembered on the device like a panel's width; a double-click on the divider resets it. While dragging,
a label says how many lanes fit of how many.** (2026-11-02, owner: "I really like the folding, I'd just like more
control… a split panel that lets us resize the graph… sensible by default, even a percentage of the container… the
graph collapses depending on the available width"; the default share, the reset and the label are the design agent's;
CH10, CH11, CH44, CH45)

**Why.** Folding keeps a very wide graph from breaking the layout, and the user decides how much of a busy repository's
graph is worth the width. Panel widths are local ([settings-sync D7](../settings-sync/DECISIONS.md#d7)).

**Rejected.**

- One lane at the narrowest — every commit on one line, so the default branch can't be told from the rest (owner,
  2026-11-03; [history](history/DECISIONS.md#d17)).
- A fixed cap of six lanes — no control over it (owner).
- Every lane at full width, always — the message moves with every open branch.

## D18

**A row reads: graph, worktree markers (desktop), branches and tags, headline, then right after the headline the
pull request's state and number and the CI mark; the author (16 px avatar and name) and the age are aligned at the
right edge. Rows alternate with a very faint stripe. A failing commit is a red dot and a red ✕ after its pull request,
and its text is never red; running is amber in both places. A merge is a hollow dot with a dimmed headline. Pull request
and CI not known yet are an empty bar, never a blank. Where the rows are narrow (details open, the column layout) the
headline is cut first and the author's name gives way to the avatar.** (2026-11-02, owner: pull request and checks to
the right of the headline, "not somewhere far right in a separate column"; the author as avatar and name, the avatar a
little smaller; failing as a red dot and a red ✕ "but no red text"; "a very gentle zebra" to tie a dot to its row;
the narrow-row rule is the design agent's; CH12, CH34)

**Why.** Read with the headline, the pull request and CI belong to it; in a far column they are hard to tie to the
right commit. The stripe carries the eye from a dot far to the left to its row in a wide graph.

**Rejected.**

- Pull request and CI in fixed columns at the right edge — read badly, far from the headline (owner).
- A red headline or a red-tinted row for a failure (owner; the screens were CH13, CH14, deleted).
- The author as an avatar alone (owner).

## D19

**Commits loaded later on a first open appear between rows already on screen with no tint or motion, and the row
under the cursor keeps its place, whether the user has moved the cursor yet or not: newer commits land above the
screen. The status bar says branches are filling in.** (2026-11-02, design agent's proposal; CH32, CH33; a cursor not
yet moved settled by the owner 2026-11-03)

**Why.** They are not news, only late; marking them would make them read as something that just happened.

**Rejected.**

- A cursor not yet moved following the newest commit as branches arrive — the row being read jumps down in the first
  seconds (owner, 2026-11-03).

## D20

**In an untracked repository, the explanation that it is not tracked moves into Issues and Pull requests and is
about them only; it also says Commits needs no tracking. The "not tracked" chip stays in the header.**
(2026-11-02, design agent's proposal; CH37, CH10)

**Why.** [D11](#d11): Commits works in full without tracking, so a repository-wide warning would be wrong on it.

## D21

**Desktop, second step: a worktree shows in the branch and tag list as a row nested under the branch it has checked
out (its folder's name and its count of uncommitted changes), and in the graph as a marker on its commit; there is no
Worktrees section. A worktree on a bare commit has no row and is found in the graph only. A worktree's actions are in a
menu, opened from its row (`.`) or its marker, starting with Reveal in Finder and Copy path. A clone is added from the
Commits header ("Add a local clone") or the command menu; the two refusals of [D7](#d7) and [D5](#d5) are dialogs naming
the folder and the way out.** (2026-11-02, owner picked worktrees on their branches, CD2, over a Worktrees section, CD1;
the nested row, the menu and the dialogs are the design agent's; `githq.pen` "Desktop · Commits", CD2–CD7)

**Why.** The list stays one list of branches and tags, and each worktree sits next to the branch it works on. The marker
in the graph already says where each agent stands, including the one with no branch. A menu is the place a list of
actions can grow without crowding the row.

**Rejected.**

- A Worktrees section opening the list (CD1, deleted) — owner picked CD2.
- The worktree's name and count as a badge on the branch row — the branch name no longer fits in the list's width.

## D22

**Settings gains a Display section, between Projects and Code review (`3`; Settings is now a column of sections,
[githq D26](../githq/DECISIONS.md)). Its first setting is the repository layout of [D14](#d14), two cards with a sketch of each; the change applies at
once; where it is saved shows in the status bar.** (2026-11-02, owner asked for the setting in "a
tab like General or Display"; the section's name and place are the design agent's; CH43)

Until the Settings column and that status bar are built, a line under the cards says where the choice is saved, so a
synced setting never looks unsaved (owner, 2026-11-03).

**Why.** Display is where a layout is looked for, and it leaves room for later preferences of the same kind; General
would collect anything.

## D23

**The repository's sections tell how current they are in the status bar only. The Commits header holds the title, the
tabs, the branch list's tool and the GitHub mark, an icon alone.** (2026-11-03, owner; CH3 and every Commits screen
redrawn without the header's freshness mark)

**Why.** The status bar already says it on every screen, and the header has no room to spare in a calm view.

**Rejected.**

- A freshness mark in the Commits header as well (the first drawing of CH3) — the same fact in two places (owner).
