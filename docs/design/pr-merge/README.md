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

GitHub's asynchronous merge endpoint handles direct merges, merge queues, stacks and admin bypass with one
call, which accepts the request and finishes in the background. GraphQL's merge mutation cannot merge stacks,
which is how this repository itself works. So [the asynchronous endpoint is the proposed default](DECISIONS.md#d5),
with GraphQL only for the two things it alone can do: choosing the commit email and jumping the queue.

## Still open

- Whether the merge can be sent while githq is still reading the pull request's fresh state, or has to wait.
- How a merge is started: its key, from the list and the command palette as well as the opened item, and
  whether several pull requests can be merged at once.
- Whether merging a pull request that changes `.github/workflows` works with githq's current OAuth scopes.
  If it needs the `workflow` scope, everyone has to sign in again.

When this design closes, the statements that githq does not merge have to change with it: the design of githq
as a whole says so in its decisions, its story and its UI briefs, and so does the note in the pull request's
merge panel. The wider aim above, running all of GitHub from here, belongs in that design's story too.
