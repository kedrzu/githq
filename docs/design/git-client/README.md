# Commit history and, later, a git client in githq

> Closed 2026-11-02, ready to build the first version.

githq today is a client for GitHub's issues, pull requests and projects. This design adds the code side of a
repository, starting with the smallest piece: a view of a repository's commit history drawn as a graph, with
its branches and tags — the kind of view Fork or GitKraken open on — without file contents or diffs yet.

Where it is meant to go is further: in the desktop app, a full git client for your local clones, tied tightly
into everything githq already knows from GitHub, so that githq is the one place development is run from, and
moving between your local work and GitHub feels continuous. The web app should feel the same, as far as a
browser allows: it cannot fetch into your local repository or manage your worktrees.

## Why

Development today is spread over several tools that each know a part of it: a git client or the terminal
for local branches and commits, github.com for pull requests, reviews and CI, and a tracker for tasks. Every
switch between them costs time and context, and none of them shows the whole picture: a git client does not
know that a branch is a pull request with failing CI that closes an issue, and github.com does not know what
you have not pushed yet. The owner wants one app for git, GitHub, review and tasks, as fast as the rest of
githq.

## How far this design goes

This design covers the commit graph of one repository at a time (branches across all repositories are not
useful), first read from GitHub on the web and the desktop, then the local clone on the desktop, and later
writing to it as a full git client. An agent orchestrator built into githq, in the spirit of Conductor or
Paseo, may follow; it is a design of its own, not part of this one.

## Where the commit graph comes from

A commit graph is the same data wherever it is read from: commits (id, parents, author, date, message) and
refs (branches and tags) pointing at them. GitHub's API returns exactly that, so the web app can draw the graph
of what is on GitHub with no copy of the repository at all. The desktop app can additionally read your local
clone, which is the only place that knows about branches you have not pushed, commits ahead of the remote,
uncommitted changes and worktrees.

A browser cannot simply clone the repository instead: github.com's git endpoints send no CORS headers, so
every byte of a clone would have to pass through a proxy we run — and a clone in the browser would still only
contain what is already on GitHub, not your local work.
[Why we do not clone in the browser](DECISIONS.md#d1).

On the desktop, githq will work with the local clone by running the user's own `git`, so their SSH keys,
credential helpers, hooks, configuration and worktrees work exactly as in the terminal.
[Why the system git and not a library](DECISIONS.md#d2).

## Your clones and their worktrees

A repository on GitHub, a clone of it on your disk and the working copies of that clone are three different
things. githq's own checkout is a good example: one main checkout plus several worktrees created by Paseo,
each with its own checked-out branch and its own uncommitted changes, all sharing one `.git`. To githq that is
one GitHub repository, one clone, and several worktrees.

The desktop app learns about a clone when you add its folder. githq matches the folder to a tracked
repository by the URL of its `origin` remote and finds the worktrees itself with `git worktree list`. Later it
may also find clones by scanning the disk. [How a clone is matched to a repository](DECISIONS.md#d5).
A fork, whose `origin` is your fork and whose `upstream` is the original, gets no special handling yet.

A repository has at most one clone in githq; parallel work happens in its worktrees. This is a deliberate
opinion: a second clone of the same repository would mix two sets of local branches in one graph, and
worktrees already give everything a second clone would. Adding the folder of a worktree adds the clone it
belongs to. Adding a second, separate clone of a repository that already has one is refused, naming the folder already
added.
[One clone per repository](DECISIONS.md#d7).

Each worktree shows up in two places: as a marker at the commit it has checked out in the graph, with the
count of its uncommitted changes, and in the list of branches beside the graph, on the branch it has checked
out. From either place you can act on the worktree itself, for a start by revealing its folder in Finder (or
the file manager of the platform). [Worktrees in the graph and the branch list](DECISIONS.md#d6).

## What a row of the graph shows

A row is a commit: its message headline, author, date, and the branches, tags and worktrees that point at it.
Next to that it shows what only githq knows: the pull request the commit came from and the state of its CI.
That is what a plain git client cannot show, and without it the graph would be a git client in a browser.

The two halves behave differently. A commit never changes, so once fetched it is kept for good. Its pull
request and CI state do change — a check finishes, a pull request is merged — and asking for them along
with every commit makes each page of history two to three times slower. So githq fetches commits in pages
on their own, and asks for the pull request and CI state only of the rows on screen, in a separate request
it can repeat to refresh them. [How the graph is fetched](DECISIONS.md#d8).

## Opening a repository's history without waiting

The graph opens from what githq already has: commits seen before are kept in the browser for good, and
the branches and tags as last seen. Only then does githq ask GitHub, in the background, where the branches
and tags point now, and fetches new commits for those that moved. So a repository opened before shows its
graph at once.

The first time, there is nothing kept yet. One request returns every branch and tag together with the
first hundred commits of the default branch, in about a second, and those are shown straight away. Then
githq looks at which branches point at commits it does not have yet, typically pull request branches a few
commits ahead, and fetches a short stretch of each one's history, going deeper only for those that still
have not met a commit it knows.

Scrolling down asks for more: the next hundred commits from wherever the loaded history stops. The rows
are ordered by date across all branches, as in `git log --date-order`, and show everything loaded so far; a
commit of a branch loaded later can appear between rows already on screen, which was judged a fair price
for the simpler drawing. [How history is paged and kept](DECISIONS.md#d9).

## Where the graph lives in the app

The graph is a tab of the repository view. The repository view today shows one list of the repository's
issues and pull requests, with tabs beside its title (All, Issues, Pull requests) that only filter that
list, and a toolbar for its state, grouping and board layout. Commits is a different kind of content, none
of whose controls apply to it, so the repository view has to become a set of sections with their own tools
rather than one filtered list. Which UI does that best is decided by designing a few directions and
picking one. [Commits as a tab of the repository](DECISIONS.md#d10).

The tab works in every repository you can see, tracked in githq or not: the graph is fetched when the tab is
opened and nothing about it is synced in the background, so there is nothing tracking would add.
[Commits without tracking](DECISIONS.md#d11).

## Beside the graph, and behind a commit

Beside the graph is the list of the repository's branches and tags (on the desktop, later, also local
branches and worktrees). Choosing one scrolls the graph to the commit it points at; it does not narrow the
graph to that branch's history. If that commit is not loaded yet — an old tag, say — its details open
instead, rather than loading years of history to reach it. [The branch list scrolls](DECISIONS.md#d12).

Choosing a commit opens its details: the full message, the author, its parents (each a way to that commit),
the branches and tags that point at it, its pull request and CI state, and a way to open it on GitHub. No
files and no diff yet. [What a commit shows](DECISIONS.md#d13).

## What ships first, and what comes after

First, on the web and the desktop alike: the Commits tab of the repository view, with the graph of the
repository's branches and tags as GitHub has them, each row with its pull request and CI state, paged and
kept as described above, the branch and tag list beside it, and the details of a commit. How the graph's
lines are laid out is left to the implementation; it is a known problem with known algorithms and decides
nothing about the product. The repository view's new shape is designed first, as several directions to pick
from.

After that, on the desktop: adding a local clone, its local branches and how far they are ahead of GitHub,
its worktrees as markers in the graph and entries in the branch list, and revealing a worktree's folder.
Writing to the repository — committing, fetching, pushing, managing worktrees — and diffs come later still,
and get their own pass through this design when they do.
