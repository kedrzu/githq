# Stacked pull requests in githq

## What this is

A stack is a chain of pull requests where each one builds on the one before it and they land on the same branch. GitHub
has supported them natively since October 2026. This design makes githq treat a stack as what it is to the person
working with it: one piece of work, seen, reviewed and merged together, instead of several unrelated pull requests.

## Why

The owner's agents deliver larger work as stacks, so one change becomes three or four pull requests, and several such
changes are open at once. Lists get long, and pull requests of different stacks sit mixed together, while the owner
reviews them stack by stack: 1, 2 and 3 of one, then 1, 2, 3 and 4 of the next. Nobody reads the first of one stack and
then the first of another. Today githq knows nothing about stacks, apart from what the merge design says about one at
the moment it is merged.

## What is different once it exists

Your list shows the work rather than its pieces: one entry per stack, saying how far along it is as a whole. You move
to it, open it and go through its pull requests in order, then move on to the next stack. When it is ready, you merge
all of it, or as far up as you choose, in the same two keys as any other merge. Linking pull requests into a stack, adding
one to it and dissolving it happen here too.

## One entry in a list

GitHub gives a stack a number, a target branch and a size, with no title and no status, so githq takes them from the
pull requests inside. The name comes from [the issue the stack closes, or else its first pull
request](DECISIONS.md#d4), and the state is worked out from all of them, because [a pull request can only merge once
everything before it can](DECISIONS.md#d5).

A list always has one rule for how a stack falls apart: [the pull requests of a stack that land in the same group of a
list share one entry](DECISIONS.md#d3). Without grouping, or grouped by repository, that is the whole stack. On a board
by status, a stack spread over two columns has an entry in each, saying "2 of 4", and a single pull request left alone in
a column is an ordinary row marked as part of a stack. So nothing needs to decide whether a view can group.

## Reading order

Pull requests are listed [from the first to the last](DECISIONS.md#d6), since that is the order you read them in.
GitHub draws them the other way around, with the target branch at the bottom, and it says "below" for the ones that
merge along. In githq those are the earlier ones.

## What a stack brings into the copy

githq keeps what concerns you and what you track, and one stack can be partly neither: a colleague may have asked for
your review of only two of its four pull requests. [githq copies the rest of the stack too](DECISIONS.md#d7), so that the
entry is always whole.

## What cannot be done from githq

[GitHub has no API for "Rebase stack"](DECISIONS.md#d8), the button needed after a push to an earlier pull request or
when the target branch moves. githq says why the stack cannot merge and links to the button.

## Where this stands

Being worked out with the owner. Settled: stacks are grouped in lists, and all of seeing, merging and managing them is in.
Proposed and not yet confirmed: everything marked so in [the decisions](DECISIONS.md). The screens come next, in a separate
branch, from a brief still to be written.
