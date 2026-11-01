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
