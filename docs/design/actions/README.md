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
version. Looking at the latest commit misses it too, because that commit's checks are green. What is actually
broken is a workflow whose latest finished run failed, so githq asks about each workflow rather than about
runs or commits. [The proposal and what it was tested on](DECISIONS.md#d1).

Not every failure matters equally. Most runs in a busy repository can belong to bots and pull requests, and a
failure on somebody's branch is that pull request's business. A release, however, runs on a tag and not on the
default branch, so "default branch only" would hide exactly the failure you most want to see. Where to draw
this line is still open.

## How it fits what GitHub allows

GitHub has no list of runs across repositories, so githq asks each tracked repository separately. That is
affordable, since an unchanged answer costs nothing against the API allowance, and it needs no new permission
at sign-in. [What we measured](DECISIONS.md#d2).

Logs can be read straight from the browser, which is what makes a better failure screen possible without a
server. [The test in a real browser](DECISIONS.md#d3).

Without a server, githq can only notice anything while it is open. Nothing here can reach you when no tab is
open, so this design does not promise that.

## How far this goes

Not settled yet. To be decided with the owner: where the signal appears, which failures count, which
repositories are covered, and what the failure screen does that GitHub's does not.
