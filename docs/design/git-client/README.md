# Commit history and, later, a git client in githq

> Draft, design in progress (started 2026-11-01). The opening below is what the owner has said so far; the
> "why" still needs his concrete cases.

githq today is a client for GitHub's issues, pull requests and projects. This design adds the code side of a
repository, starting with the smallest piece: a view of a repository's commit history drawn as a graph, with
its branches and tags — the kind of view Fork or GitKraken open on — without file contents or diffs yet.

Where it is meant to go is further: in the desktop app, a full git client for your local clones, tied tightly
into everything githq already knows from GitHub, so that githq is the one place development is run from, and
moving between your local work and GitHub feels continuous. The web app should feel the same, as far as a
browser allows: it cannot fetch into your local repository or manage your worktrees.

## Why

Not written yet: what this replaces today (a separate git client, github.com's commit list, the terminal)
and what that costs is the next thing to ask.

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
