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
conflicts, and re-running checks that do not come from GitHub Actions.

## How a merge reaches GitHub

githq talks to GitHub through GraphQL whenever GraphQL can do the job, and through REST where it cannot.
GraphQL's merge mutation cannot merge stacks, so [merges go through GitHub's asynchronous REST
endpoint](DECISIONS.md#d5). It handles direct merges, merge queues, stacks and admin bypass: GitHub accepts the
request and finishes in the background, and githq keeps asking for the result. GraphQL stays for the two things that endpoint lacks, choosing
the commit email and jumping the queue.

## Merging is two keys

[One panel opens with one key](DECISIONS.md#d7) from the opened pull request, the list or the command palette. It
starts on the repository's default method and GitHub's proposed message, so a usual merge is that key and then
⌘Enter. There is no single-key merge, because a merge cannot be undone.

[The merge does not wait for githq to re-read the pull request](DECISIONS.md#d6). The panel reads fresh state when
it opens, but if what githq holds already says ready, ⌘Enter works at once. GitHub enforces the requirements itself,
and the head commit sent with the request cancels the merge if someone pushed in the meantime. The cost is that a
check that is not required may have just failed, and you merge before seeing it.

[Several selected pull requests can be merged together](DECISIONS.md#d8), say five from Dependabot: one
confirmation, each with its own default method and message. One that fails does not stop the others, and you see
which it was.

## Still open

- Whether merging a pull request that changes `.github/workflows` works with githq's current OAuth scopes.
  If it needs the `workflow` scope, everyone has to sign in again. It takes a test with a token of exactly those
  scopes.

When this design closes, the statements that githq does not merge have to change with it: the design of githq
as a whole says so in its decisions, its story and its UI briefs, and so does the note in the pull request's
merge panel. The wider aim above, running all of GitHub from here, belongs in that design's story too.
