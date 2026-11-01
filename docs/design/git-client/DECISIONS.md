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
adding a second separate clone of the same repository offers to replace the first.** (2026-11-01, owner:
"we support only one clone per repo… opinionated, but so be it"; the handling of the two add cases is the
design agent's proposal)

**Why.** With worktrees a second clone gains almost nothing, and supporting it means several sets of local
branches in one graph and a choice of clone behind every local action.

**Rejected.**
- Several clones per repository — too much complexity for too little gain (owner).

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
