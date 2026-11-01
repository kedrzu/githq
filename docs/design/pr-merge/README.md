# Merging pull requests in githq

## What this is

Today githq shows whether a pull request can be merged, and sends you to github.com to do it. This design
adds merging to githq itself, with what surrounds it on github.com: the checks, and the merge methods the
repository allows, such as squash or rebase.

## Why

Not written yet: the owner has asked for this, and has not yet said what the trip to github.com costs them.
This section comes from them.

## What is different once it exists

You open a pull request that is ready, pick a method from those the repository allows, adjust the commit
message GitHub proposes, and merge it without leaving githq. Code review is assumed to stay on github.com;
the owner has not confirmed that.

## Which merge methods you are offered

Repository settings alone do not decide this. A ruleset on the target branch can narrow the methods further,
and required linear history rules out merge commits, so githq has to [offer only what all of them
allow](DECISIONS.md#d2).

## Still open

- Whether a merge appears instantly, like other edits in githq, or only once GitHub confirms it. A merge
  cannot be undone, and githq's picture of the pull request can be out of date.
- Which of the following belong in the first version: auto-merge, merge queues, updating the branch, merging
  as an admin past unmet requirements, deleting the branch, choosing the commit email.
- Whether merging a pull request that changes `.github/workflows` works with githq's current OAuth scopes.
  If it needs the `workflow` scope, everyone has to sign in again.

When this design closes, the statements that githq does not merge have to change with it: the design of githq
as a whole says so in its decisions, its story and its UI briefs, and so does the note in the pull request's
merge panel.
