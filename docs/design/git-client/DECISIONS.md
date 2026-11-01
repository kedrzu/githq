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
