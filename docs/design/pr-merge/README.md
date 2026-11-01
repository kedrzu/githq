# Merging pull requests in githq

## What this is

Today githq shows whether a pull request can be merged, and sends you to github.com to do it. This design
adds merging to githq itself, with what surrounds it on github.com: the checks, and the merge methods the
repository allows, such as squash or rebase.

## Why

The owner wants githq to become the one place where all their GitHub projects and repositories are run: fast,
in one place, as snappy as Linear. That means every day-to-day action, not repository settings. Merging is the
action that most often sends you away today, at the moment a piece of work ends. Code review is meant to come
here too, but later and not in this design.

## What is different once it exists

You open a pull request that is ready, pick a method from those the repository allows, adjust the commit
message GitHub proposes, and merge it without leaving githq. Whatever else your repository's way of working
asks for at that point is there as well: a merge queue, auto-merge, a stack of pull requests, updating the
branch, merging as an admin past unmet requirements. Nobody's workflow should be the reason to go back to
github.com.

## Which merge methods you are offered

Repository settings alone do not decide this. A ruleset on the target branch can narrow the methods further,
and required linear history rules out merge commits, so githq has to [offer only what all of them
allow](DECISIONS.md#d2).

## A merge shows when GitHub confirms it

Other edits in githq appear at once and quietly roll back if GitHub refuses. A merge cannot be undone, so
[it shows as merged only once GitHub confirms it](DECISIONS.md#d3). Until then the pull request reads as being
merged, and the rest of the app stays usable.

## All of GitHub's options

[Every option github.com offers at this point is in](DECISIONS.md#d4), so that no particular workflow is left
out. Two things cannot be done from githq and link to github.com instead: the web editor for resolving
conflicts, and re-running checks that do not come from GitHub Actions. [The panel holds what shapes the
merge](DECISIONS.md#d10): method, message, email, auto-merge, the queue and bypass. The rest, such as updating the
branch or reverting, are ordinary commands.

## How a merge reaches GitHub

githq talks to GitHub through GraphQL whenever GraphQL can do the job, and through REST where it cannot.
GraphQL's merge mutation cannot merge stacks, so [merges go through GitHub's asynchronous REST
endpoint](DECISIONS.md#d5). It handles direct merges, merge queues, stacks and admin bypass: GitHub accepts the
request and finishes in the background, and githq keeps asking for the result. GraphQL stays for the two things that endpoint lacks, choosing
the commit email and jumping the queue.

## Merging is two keys

[One panel opens with `Shift+M`](DECISIONS.md#d7) from the opened pull request, the list or the command palette. It
starts on the repository's default method and GitHub's proposed message, so a usual merge is that shortcut and then
⌘Enter. There is no single-key merge, because a merge cannot be undone.

[The merge does not wait for githq to re-read the pull request](DECISIONS.md#d6). The panel reads fresh state when
it opens, but if what githq holds already says ready, ⌘Enter works at once. GitHub enforces the requirements itself,
and the head commit sent with the request cancels the merge if someone pushed in the meantime. The cost is that a
check that is not required may have just failed, and you merge before seeing it.

[Pull requests are merged one at a time](DECISIONS.md#d9), and after a merge from the list, the list moves to the
next one. Merging several together stays out of this design. Every merge moves the target branch, so the later ones
can fall behind or conflict, and handling that is a feature of its own: a queue of merges in githq, built later.

## What gets built first

Proposed order, each step usable on its own:

1. A test of merging a pull request that changes `.github/workflows` with a token of exactly githq's scopes. If it
   needs the `workflow` scope, everyone has to sign in again; that is the one open question, and its answer does not
   change the rest of this design.
2. A merge from the panel: the allowed methods, the proposed message, required checks marked, the merge shown once
   GitHub confirms it.
3. What stacks and queues need, then auto-merge, bypass and the commit email.
4. The ordinary commands: updating the branch, deleting and restoring it, reverting, re-running checks.

Code review in githq and merging several together are not part of this.

How a stack looks in lists and how it merges as a whole is [its own design](../stacked-prs/README.md).

## Where this stands

The design is closed. The screens come next, from [the brief for merging a pull
request](ui/merge-a-pull-request.md), and then the build in the order above. The note in the pull request's merge
panel saying that merging happens on GitHub stays true until the build changes it, so it goes with the build.
