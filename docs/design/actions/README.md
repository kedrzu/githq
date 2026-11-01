# Seeing GitHub Actions failures in githq

githq shows the state of GitHub Actions across the repositories you work in, and lets you go from "something
is red" to the reason why without leaving the app. It reads everything from GitHub, as the rest of githq does.

## Why

A workflow fails in some repository and nobody notices. GitHub only reports a finished run to the person who
triggered it, so a nightly job or a deploy started by a merge can stay broken until something else depends on
it. Finding out means opening each repository's Actions tab, one at a time, and the way from there to the
failing line of a log takes several slow screens.

## What is different once it exists

Something in githq you already look at tells you that a workflow is broken, in whichever repository. One
screen shows what is broken across all of them. From there, one keystroke opens the failure at the line that
explains it, with no page loads in between.

## What "broken" means

The obvious list, recent failed runs, answers the wrong question. A deploy fails at 3am, the morning brings
twenty passing runs of other workflows, and the failure has scrolled away while production is still on the old
version. Looking at the latest commit misses it too, because that commit's checks are green. So githq asks about
each workflow rather than about runs or commits.

The same workflow can run on `main` and on a feature branch, and a pass on the branch says nothing about `main`.
So state is kept per workflow and per group of refs. A group rather than a single ref, because a release tag runs
only once: if `v1.0-rc.1` fails and `v1.0-rc.3` passes, the release is fine again. A cancelled run says nothing
either way. [The rule and the runs it was tested on](DECISIONS.md#d1).

Each repository can say, with wildcards, which refs light the counters, for example only `main` and `release/*`.
That setting only affects counters: every workflow and run stays visible in the repository, so a wrong pattern
cannot hide a failure from someone looking for it. [What this setting does, and what is still open
about it](DECISIONS.md#d5).

## Where you see it

Only repositories you already track are covered. [The owner's call](DECISIONS.md#d4).

A repository's page gets a Workflows tab next to issues and pull requests. It lists all the workflows, passing
ones too, one per row with their recent runs, unlike GitHub's single feed where every workflow's runs are mixed
together. The broken ones also appear at the top of the repository's All tab, in a block of their own, because
a workflow has no milestone or assignee to be grouped by among the issues.
[What the block does](DECISIONS.md#d8).

A repository with something broken gets a red marker in the sidebar. And because you may not know which repository
to look in, one sidebar entry gives the total and opens everything broken across repositories.
[Why not nested menus or columns](DECISIONS.md#d6).

## How it fits what GitHub allows

GitHub has no list of runs across repositories, so githq asks each tracked repository separately. That is
affordable, since an unchanged answer costs nothing against the API allowance, and it needs no new permission
at sign-in. [What we measured](DECISIONS.md#d2).

Logs can be read straight from the browser, which is what makes a better failure screen possible without a
server. [The test in a real browser](DECISIONS.md#d3).

Without a server, githq can only notice anything while it is open. Nothing here can reach you when no tab is
open, so this design does not promise that.

## How far this goes

Not settled yet. To be decided with the owner: the default refs before any configuration, whether a workflow can be silenced, and what the failure screen does that GitHub's does not.
