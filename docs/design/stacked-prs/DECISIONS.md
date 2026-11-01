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

**The pull requests of one stack that land in the same group of a list share one entry; a stack spread over groups has an
entry in each ("2 of 4"), and one alone in a group is a plain row marked as part of a stack.** Exception: in my work by reason
the whole stack is one entry, in the first of the four reasons that any of its pull requests has. Dragging an entry on a board
moves the pull requests of that entry. A stack with one open pull request left is a plain row too. (2026-11-01, owner, picking
the design agent's proposal over the simpler version below)

**Why.** One rule covers list, board and every grouping, so no view has to decide whether it can group. Reasons are not a field
someone sets per pull request, so nothing is lost by keeping the stack whole there, and my work already lists each item once
(`packages/app/myWork/buildMyWork.ts:54`). Filters: any match shows the group's members, the rest de-emphasized. Sort: the
stack's place comes from its best matching member; members keep their order. Counts: top-level entries, as with nested pull
requests in my work.

> **Checked 2026-11-01:** lists already have an entry with nested entries (`ListRow`, `packages/app/lists/ListTypes.ts:33`),
> rendered on rows and cards (`packages/app/lists/ListView.vue:584`, `:660`). An item with two labels is listed under each.

**Rejected.**

- A shared entry only where the whole stack fits (no grouping, by repository, my work), plain rows with a marker elsewhere —
  closest to the owner's words and drops dragging part of a stack, but pull requests of different stacks mix again on a board,
  which is the problem being solved, for about the same code.

## D4

**A stack's name is the title of the issue it closes, otherwise the title of its first pull request, with the
count.** (2026-11-01, owner, on the design agent's proposal)

**Why.** GitHub has no title for a stack, and "Stack #42" says nothing. The first pull request's title, by position, stays
the same after a partial merge. If it closes several issues or the issue is not in the copy, it falls to the next rule: the
first in the list, then the pull request's title.

> **Checked 2026-11-01 (live):** stack 11 is #5, #9, #10, two of them closing #4, so the issue names it well and "Set up the
> githq workspace" would not. Stack 42 is #36, #41 with no issue, and "Draw the key glyphs… +1" is fair.

**Rejected.**

- Always the first pull request's title — one rule with no lookup, but it names only the first piece.
- "Stack #42", as GitHub's proposal does — says nothing.

## D5

**A stack's state is worked out from its pull requests: how many are ready, and what blocks the first one that cannot merge
("2 of 4 ready, #36 blocks"). Single rows carry only their own state, and the merge panel explains what holds them back.**
(2026-11-01, owner, on the design agent's recommendation)

**Why.** "All pull requests below it also meet those requirements", and the history must be linear
([reference](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests)). Not found: whether `mergeable` or
`mergeStateStatus` already reflect this. Needs a live test on an open stack; the computation holds either way.

**Rejected.**

- A "blocked by an earlier one" mark on each row — entries start collapsed, so rows are rarely seen, and GitHub may already say
  it. Cost accepted: an expanded green row reads as ready until the panel opens.

## D6

**Pull requests of a stack are listed first to last, and the words are "earlier" and "later".** (2026-11-01, owner, on the
design agent's proposal, from the owner's "1, 2, 3")

**Why.** That is the reading order. It is the opposite of GitHub's picture, trunk at the bottom, so "below" from the merge brief
would be wrong on screen.

## D7

**When a pull request in the copy belongs to a stack, the rest of the stack is copied too; rows hold position, size and stack
number. While the copy holds fewer pull requests than the size says, the entry does not read as ready.** (2026-11-01, owner, on
the design agent's recommendation)

**Why.** Otherwise a stack whose review was requested for two of four shows a partial entry, and the merge panel cannot name what
merges along. Also closes the open question in the merge brief, `⌘Enter` before the read
([brief](../pr-merge/ui/merge-a-pull-request.md)): the row knows. The stack's own pull requests are a small read. The merge goes to
a pull request by number, so one added on top since the last refresh is simply not merged.

> **Checked 2026-11-01:** `PullRequest.stack`, `stackEntry.position`, `PullRequestStack.entries`
> (`packages/github/src/schema.graphql:45321`, `:47197`, `:47247`). REST `/pulls` carries `stack` as well, with `base.sha` null on
> merged stacks (live, #9). Not tested: whether joining a stack moves `updated_at`, which change detection relies on.

**Rejected.**

- Rows knowing only their own position, the rest read on opening — a spinner on navigation, for a few extra pull requests of
  someone else's stack.

## D8

**"Rebase stack" links to github.com, with the reason shown.** (2026-11-01, owner, on the design agent's proposal)

**Why.** Merging needs linear history, and a push to an earlier pull request or a moved target breaks it.

> **Checked 2026-11-01, not found:** an API for it (OpenAPI, the stacks page, GraphQL mutations). The website button or
> `gh stack rebase` only. Not found: how `updatePullRequestBranch` behaves on a stacked pull request.

## D9

**`Enter` on a stack's entry opens a pull request, with a map of the whole stack beside its content; there is no separate
screen for a stack. `O` takes that pull request to github.com, and moving through pull requests and stacks happens in
githq.** (2026-11-01, owner, on the design agent's proposal; review itself is to come to githq later)

**Why.** A stack has no content of its own beyond its pull requests, and the collapsed entry already says how it stands.
This keeps working when review moves into githq.

The pull request opened is the first open one not yet approved, otherwise the
first open one. `J` and `K` in the opened item walk the list's pull requests one by one, so the last of one stack is followed
by the first of the next, and no new key is needed.

> **Checked 2026-11-01:** `J`/`K` step through `ItemList.ids`, the ids the list shows in its order
> (`packages/app/item/ItemNavigation.ts:13`), so it only has to hand over a collapsed stack's members too. `Shift+J` and
> `Shift+K` extend the selection in a list (`packages/app/lists/ListView.vue:251`). GitHub uses them to walk a stack
> ([changelog](https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available)).

**Rejected.**

- `O` on the entry going straight to github.com, walking the stack with GitHub's keys — nothing to look at in githq first, and
  it would have to be redone when review comes here.
- A screen for the stack — it would only repeat the entry; it wins only with something like a combined diff, which GitHub does
  not provide.

## D10

**A stack's entry is collapsed by default; expanding it lasts for the session, in memory.** (2026-11-01, owner; the memory on
the design agent's recommendation)

**Why.** That is what shortens the list. The cost is that trouble in the third pull request shows only through the stack's
state ([D5](#d5)), so the state has to make it plain.

**Rejected.**

- Expanded by default, as in GitHub's proposal ([discussion](https://github.com/github/gh-stack/discussions/474)) — the rows stay
  as many as before.
- Remembering what was expanded across restarts — a new thing to keep and clean up, for a stack one goes through and leaves.

## D11

**`⇧M` on a stack's entry opens the merge panel for the whole stack, on a pull request for everything up to it, and the panel
lets the user change how far. The panel names what merges. With two or more pull requests there is no commit text to edit: each
lands under its own title. After a failed merge githq reads the whole stack again and shows what is true.** (2026-11-01, owner, on
the design agent's proposal; the panel is the [merge design's](../pr-merge/DECISIONS.md#d7))

**Why.** An entry stands for the work, and the owner lands stacks whole. `⌘Enter` before the panel's read is safe because the row
and the copy already know the members ([D7](#d7)). Merging up to a pull request cannot skip earlier ones.

> **Checked 2026-11-01:** "You can merge any number of pull requests at once, as long as they form a contiguous group starting from
> the lowest unmerged pull request"
> ([merging](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests)). Bypass:
> "only the bottom pull request" ([reference](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests)). Docs
> disagree on three things, unresolved: atomic against "remain landed" on a partway failure; auto-merge "not supported" against
> "rolling out" ([changelog](https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available)); and what one title
> does to several squashes is not stated. `.claude/skills/git-workflow/SKILL.md` lands stacks with `merge_method` only, one squash per
> pull request under its title.

**Rejected.**

- One commit title and message for the stack (what the merge screens assumed, PM17) — GitHub does not say what it does.
- Merging from an entry only what that entry holds — on a board "2 of 4" could mean pull requests that cannot merge alone.

## D12

**In my work, a stack with a pull request closing an assigned issue goes under that issue, whole, and the issue serves as the
stack's header; there is no third level.** Two stacks under one issue each get their own header. (2026-11-01, owner, on the design
agent's proposal)

**Why.** Today only pull requests that close the issue move under it (`packages/app/myWork/buildMyWork.ts:92`), and `Closes` is
usually in one of a stack's pull requests, so the stack would be torn apart.

> **Checked 2026-11-01 (live):** stack 11 closes #4 from #5 and #10, with nothing on #9.

## D13

**Commands: link selected pull requests into a stack, add one on top, dissolve a stack, each sent to REST and shown from GitHub's
answer. Only GitHub's stacks count as stacks; a chain of bases is ordinary rows, and githq offers linking when it sees one in an opened
pull request.** Reordering and removing one are dissolve and link again. (2026-11-01, design agent; the commands are the owner's
[D1](#d1), the chains unconfirmed)

**Why.** GitHub draws the same line, a banner offering to form the stack. Rows already hold `headRefName` and `baseRefName`
(`packages/github/src/operations/fragments/PullRequestFields.gql:35`).

> **Checked 2026-11-01:** dissolving keeps merged and queued pull requests in the stack
> ([managing](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/managing-stacked-pull-requests)).

**Rejected.**

- Treating any chain of bases as a stack — merge rules and merging differ for those, so githq would promise what GitHub does not do.
- Link, add and dissolve as links to github.com, as "Rebase stack" — the owner wants all of it here.

## D14

**A stack's entry is a two-line row like any other, with a stack icon, no number of its own, a chevron in the gutter, the name and count,
and pips: one per pull request in order, each in its own state, beside the state in words.** Merged ones stay as pips. The pip of the pull
request open in the item is tall, so the entry shows where you are while collapsed. (2026-11-01, design agent, SP10a; the owner picks)

**Why.** Keeping the row's height keeps the list calm next to ordinary rows. Only an entry has pips, so it cannot be taken for a pull request,
and an issue with nested pull requests has its own number and no fold (SP11). The pips answer [D10](#d10)'s cost: where the trouble sits is
visible collapsed. Beyond 12 pull requests pips narrow; a stack too large for them to fit is not drawn.

**Rejected.**

- One line (SP10b) — a third less height, but the state is cut to fit and it breaks the rhythm of the list.
- Words only (SP10c) — no new element, but it cannot show where the trouble sits or where you are.

## D15

**When an entry's pull requests differ: assignees are the union, up to three faces and +N; labels and project fields are those all share, the
rest +N; milestone only when shared, otherwise "2 milestones"; size the sum; updated the latest.** (2026-11-01, design agent, SP12)

**Why.** The row must stay one line of properties, and expanding shows the rest.

## D16

**A share of a stack on a board or in a group reads "2 of 4", and its pips show this share filled and the others hollow. A lone row or card
carries a small marker: icon, pips with this one tall, and its place ("3 of 4"), with no chevron.** (2026-11-01, design agent, SP13, SP24, SP26,
SP27a; the owner picks)

**Rejected.**

- A second edge behind the card (SP27b) — says "several" sooner, as decoration on a calm board.

## D17

**The map never scrolls away. In a panel it is pinned between the toolbar and the content; a stack of more than six shows a window that follows
you, one before and two after, with the rest folded into a line that says what they hold. In a modal and on a full page it sits at the top of the
side column, whole.** `K` and `J` show on the neighbours, and the row after the last names the next stack. (2026-11-01, design agent, SP30a,
SP31a, SP33–SP36a; the owner picks)

**Why.** `J` and `K` then change only what is highlighted. A panel has no side column and little height; the other two have room, in the same
place in both, so moving between them does not move the map.

**Rejected.**

- One line of pips and neighbours in a panel (SP32b) — fits any size, but what is next is only learned by going.
- Its own column on the left of a full page (SP37b) — reads as contents, costs 300 px of reading width and shifts the layout between items.

## D18

**How far is a line in the panel's list, moved with `↑` and `↓`. Later ones stay dimmed below it and the button counts.** (2026-11-01, design
agent, SP41a; the owner picks)

**Why.** The usual merge gains no key. The line cannot skip, which is GitHub's own rule ([D11](#d11)).

With exactly one going, the merge is an ordinary one and the commit text is back (SP43). The first open pull request is the only one that can
go alone, so GitHub's unclear handling of titles ([D11](#d11)) does not arise.

**Rejected.**

- A "How far" line with its own key (SP41b) — one key more, and the list no longer shows the cut.

## D19

**When a stack is held, `⇧M` opens with the line at the last one that can land, and `⌘↵` lands those.** The panel says "2 of 4 can land" and who
holds the rest. (2026-11-01, design agent, SP45a; **the owner picks: a merge cannot be undone**)

**Why.** Same two keys, and it is what the map's "Merge 2 of 4" promises. Cost accepted: landing part of a stack by habit, softened by the amber
verdict and the count on the button. Earlier pull requests in a stack are meant to be able to land first.

**Rejected.**

- Nothing armed until `↑` picks a place (SP45b) — safer against habit, one key more every time. A real alternative, for the owner to weigh.

## D20

**`X` on a collapsed entry selects it whole, and the count is of pull requests. `⇧J` crosses a collapsed entry in one step and an expanded one row
by row. `X` on a row inside selects that one, with a half mark on the entry.** (2026-11-01, design agent, SP28)

**Why.** Edits on an entry apply to its pull requests, so the count must say how many will change.

## D21

**A stack needing a rebase reads amber, all pips amber, with the sentence "Needs rebase · nothing can merge". When selected it shows "Rebase on
GitHub" on `⇧M`, and in the panel `⌘↵` opens GitHub. It keeps its place in the list.** (2026-11-01, design agent, SP15a, SP46; the owner picks)

**Why.** Amber, because nothing is wrong with the code and something must happen elsewhere; red stays for what is broken. `⇧M` already means "land
this", so no key is added. It is frequent, so it must not shout or reorder.

> **Not found:** a field saying that a stack needs rebasing, or why ([D8](#d8)). SP46 and SP47 tell a moved target from an earlier push; they need
> this settled in the live test.

**Rejected.**

- The way out on every such row, selected or not (SP15b) — plainer, noisier for something this frequent.

## D22

**Link, add and dissolve are palette and item menu commands with no single keys, opening the merge panel's surface. Linking shows the order from
the branches, with each base, and there is nothing to arrange. Refusals githq can see from the branches appear before sending. Add lists pull
requests based on the last one's branch. Dissolving says per pull request who stays and who leaves.** (2026-11-01, design agent, SP70–SP79)

**Why.** They are rare, so they don't earn keys. GitHub links by chain, so a chosen order would be false.

## D23

**`↵` on an issue serving as a stack's header opens the issue; `J` then walks into the stack. Two stacks under one issue each get a header one step
in, with their rows on a rail below it.** (2026-11-01, design agent, SP21, SP22)

**Why.** The issue is an item with content of its own, unlike a stack's entry. Two stacks are the one case [D12](#d12) leaves open: their own headers
make one more level than "no third level" suggests. It is rare, and the owner may prefer otherwise.

## D24

**A merged entry goes purple and leaves at the next refresh. The toolbar's position counts pull requests walked, not entries, so it can exceed the
list's count.** (2026-11-01, design agent, SP8, SP3)

**Why.** `J` steps through pull requests ([D9](#d9)), and the count of entries is for the list ([D3](#d3)).
