# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the decision's ID alone,
so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired decisions, the journal and notes
from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history they link to.**
Reopening a rejected option is right when its premise changed; repeating it without knowing it was rejected is
not.

## D1

**githq covers seeing, merging and managing stacks: linking existing pull requests into a stack, adding one on top and
dissolving a stack. Creating pull requests stays out, as everywhere in githq.** (2026-11-01, owner: "all levels")

**Why.** Part of githq being the one place to run GitHub day to day ([merging design](../pr-merge/DECISIONS.md#d4)).

> **Checked 2026-11-01:** generally available on all github.com plans, no enablement; Enterprise Server later
> ([changelog](https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available)). Same repository only,
> linear chains only ([reference](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests)).
> A chain of bases alone is not a stack: GitHub "shows a recommendation banner"
> ([creating](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-stacked-pull-requests)).

> **Checked 2026-11-01:** "The GraphQL API is read-only for stacks"
> ([APIs](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests-apis-and-webhooks)). REST:
> `GET`/`POST /repos/{o}/{r}/stacks` (`?pull_request=N`), `GET …/stacks/{n}`, `POST …/stacks/{n}/add` (top only),
> `POST …/stacks/{n}/unstack`. Not found: removing one chosen pull request or reordering. OAuth scope of `/stacks` not
> stated; `GET` worked live with a `repo` token, writes not tried. Unstack keeps merged and queued pull requests in the stack
> ([managing](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/managing-stacked-pull-requests)).

**Rejected.**

- Seeing and merging only, leaving management to `gh` (the agent's first guess at what matters) — the owner wants all.

## D2

**A stack is one piece of work: lists group its pull requests instead of mixing them with others, and it is the unit the
owner goes through.** (2026-11-01, owner: "agents create PRs with many sub-PRs, I don't want to see them mixed"; "I
review per stack")

**Why.** The owner reads 1, 2, 3 of one stack and then the next; stacks multiply the number of pull requests.

> **Checked 2026-11-01:** a GitHub designer proposed the same as a display option: nested groups, stack ID, repository and
> count on the parent, members not reordered by the sort, any match shows all members with the others de-emphasized, the
> stack placed by its best matching member
> ([discussion](https://github.com/github/gh-stack/discussions/474), closed, exploration only). Users there asked for it
> on by default and for an overall status. What shipped: "View details about the stack … from the pull requests list view"
> ([changelog](https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available)).

**Rejected.**

- Separate rows, adjacent, with a position marker (the agent's first recommendation) — pull requests stay as many rows, which
  is the problem the owner is describing.

## D3

**Proposed: the pull requests of one stack that land in the same group of a list share one entry; a stack spread over
groups has an entry in each ("2 of 4"), and one alone in a group is a plain row marked as part of a stack.** Exception: in
my work by reason the whole stack is one entry, in the first of the four reasons that any of its pull requests has.
(2026-11-01, design agent, from the owner's "group when possible, otherwise just show it's from a stack")

**Why.** One rule covers list, board and every grouping, so no view has to decide whether it can group. Reasons are not a field
someone sets per pull request, so nothing is lost by keeping the stack whole there, and my work already lists each item once
(`packages/app/myWork/buildMyWork.ts:54`). Filters: any match shows the group's members, the rest de-emphasized. Sort: the
stack's place comes from its best matching member; members keep their order. Counts: top-level entries, as with nested pull
requests in my work.

> **Checked 2026-11-01:** lists already have an entry with nested entries (`ListRow`, `packages/app/lists/ListTypes.ts:33`),
> rendered on rows and cards (`packages/app/lists/ListView.vue:584`, `:660`). An item with two labels is listed under each.

**Rejected.**

- Grouping only in views where the whole stack fits, flat otherwise — needs a rule per view and flips as members change status.

## D4

**Proposed: a stack's name is the title of the issue it closes, otherwise the title of its first pull request, with the
count.** (2026-11-01, design agent)

**Why.** GitHub has no title for a stack, and "Stack #42" says nothing. The first pull request's title, by position, stays
the same after a partial merge.

> **Checked 2026-11-01 (live):** stack 11 is #5, #9, #10, two of them closing #4, so the issue names it well and "Set up the
> githq workspace" would not. Stack 42 is #36, #41 with no issue, and "Draw the key glyphs… +1" is fair.

## D5

**Proposed: a stack's state is worked out from its pull requests: how many are approved and passing, and what blocks the
first one that cannot merge. A pull request shows it is blocked by an earlier one even if it is green itself.** (2026-11-01,
design agent)

**Why.** "All pull requests below it also meet those requirements", and the history must be linear
([reference](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests)). Not found: whether `mergeable` or
`mergeStateStatus` already reflect this. Needs a live test on an open stack; the computation holds either way.

## D6

**Proposed: pull requests of a stack are listed first to last, and the words are "earlier" and "later".** (2026-11-01, design
agent, from the owner's "1, 2, 3")

**Why.** That is the reading order. It is the opposite of GitHub's picture, trunk at the bottom, so "below" from the merge brief
would be wrong on screen.

## D7

**Proposed: when a pull request in the copy belongs to a stack, the rest of the stack is copied too; rows hold position, size
and stack number.** (2026-11-01, design agent)

**Why.** Otherwise a stack whose review was requested for two of four shows a partial entry, and the merge panel cannot name what
merges along. Also closes the open question in the merge brief, `⌘Enter` before the read
([brief](../pr-merge/ui/merge-a-pull-request.md)): the row knows.

> **Checked 2026-11-01:** `PullRequest.stack`, `stackEntry.position`, `PullRequestStack.entries`
> (`packages/github/src/schema.graphql:45321`, `:47197`, `:47247`). REST `/pulls` carries `stack` as well, with `base.sha` null on
> merged stacks (live, #9). Not tested: whether joining a stack moves `updated_at`, which change detection relies on.

## D8

**Proposed: "Rebase stack" links to github.com, with the reason shown.** (2026-11-01, design agent)

**Why.** Merging needs linear history, and a push to an earlier pull request or a moved target breaks it.

> **Checked 2026-11-01, not found:** an API for it (OpenAPI, the stacks page, GraphQL mutations). The website button or
> `gh stack rebase` only. Not found: how `updatePullRequestBranch` behaves on a stacked pull request.
