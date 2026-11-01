# Commit history and, later, a git client in githq

> Draft, design in progress (started 2026-11-01).

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
belongs to. Adding a second, separate clone of a repository that already has one asks whether to replace it.
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
the branches and tags as last seen. Only then does githq ask GitHub whether the branches and tags have
moved, a check that costs nothing when they have not. So a repository opened before shows its graph at once.

The first time, there is nothing kept yet. One request returns every branch and tag together with the
first hundred commits of the default branch, in about a second, and those are shown straight away. Then
githq looks at which branches point at commits it does not have yet, typically pull request branches a few
commits ahead, and fetches a short stretch of each one's history, going deeper only for those that still
have not met a commit it knows.

Scrolling down asks for more: the next hundred commits from wherever the loaded history stops. The rows
are ordered by date across all branches, as in `git log --date-order`, so githq only shows a commit once
every branch has been loaded at least down to that commit's date. Otherwise a commit from a branch loaded
later could turn up above rows already on screen. [How history is paged and kept](DECISIONS.md#d9).

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
