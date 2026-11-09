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

> **Checked 2026-11-01 (live, a scratch repository):** `POST /stacks` works with the `repo` token of `gh`.

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

> **Checked 2026-11-01 (live, a scratch repository):** they do not. With the first pull request a draft, the second and third
> still read `MERGEABLE`, `CLEAN`; GitHub refused merging them for needing a rebase while all three read `CLEAN`. githq works the
> state out itself.

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

> **Checked 2026-11-01 (live, a scratch repository):** joining a stack does not move `updated_at` of its pull requests, in REST
> or GraphQL, so change detection does not see a pull request join or leave a stack.

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

The pull request opened is the first open one not yet approved, otherwise the first open one. `J` and `K` move as they do
everywhere in the list ([D26](#d26)), so a collapsed stack is passed in one step and no new key is needed.

> **Checked 2026-11-01:** `Shift+J` and `Shift+K` extend the selection in a list. GitHub uses them to walk a stack
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

> **Checked 2026-11-02 (live, `nzymejs/githq-merge-sandbox`, stack #22 of #19–#21):** one `merge-async` `squash` on the top
> pull request, with `commit_title` "CUSTOM TITLE probe", landed all three as one squash commit each: #19 and #20 under their own
> titles (`Probe stack part 1 (#19)`), #21 under the custom title. A title given applies to the top pull request only.
>
> **Checked 2026-11-02 (live, stack #26 of #23–#25, #24's required check failing):** a `merge-async` on #25 answered `202`
> pending, then `failed` with "Required status check "ci" is failing." — and nothing landed, #23 (ready on its own) included. A
> stack refused for a failing requirement is all or none; a failure while landing midway was not reproduced.
>
> **Checked 2026-11-02 (live, the same sandbox):** `enablePullRequestAutoMerge` on a member of a stack answers UNPROCESSABLE "Auto-merge
> is not supported for stacked pull requests.", while `viewerCanEnableAutoMerge` reads true. So githq doesn't offer it in a stack (SP52).
>
> **Checked 2026-11-03 (live, stack #44 of #41, #42 on a queue branch):** `merge-async` with `sha` only on the top answers `enqueued`, and each
> member gets its own entry and position (1 and 2), not one shared. `dequeuePullRequest` on the top is refused ("No merge queue found for
> branch"), on the first it takes the whole stack out. Under a ruleset with no bypass list `viewerCanMergeAsAdmin` is false. So the
> panel (SP54) gives the group's place as the first one's and each row its own, and "Take out of queue" (`⇧Q`) is one dequeue of the
> first open one, after which githq reads the stack again. GitHub's answer names no pull request and a read just after can still say
> the old state, so GitHub accepting it is the whole answer: no such read turns it into a failure.
>
> **Decided 2026-11-03 (owner):** in a merge queue a stack behaves like a single pull request. Its first open one holds an entry: "In the
> queue" with "Take out of queue", and an `UNMERGEABLE` entry reads as PM16's "In the queue, won't merge". No entry: an ordinary stack, and
> `⌘↵` adds it again. GitHub's state doesn't say why an entry left (thrown out, or taken out on github.com or here all look the same), so
> githq doesn't say either, and nothing about the queue is remembered in the session.

**Rejected.**

- One commit title and message for the stack (what the merge screens assumed, PM17) — GitHub does not say what it does.
- Merging from an entry only what that entry holds — on a board "2 of 4" could mean pull requests that cannot merge alone.
- Per pull request wording for how a merge ended (SP59's "Refused" and "Still open", SP60's own screen, SP62's rows) — a refused stack
  lands nothing (checked above), and the rows of the stack read again already say what is true. One band carries GitHub's words, and
  "Merge stopped at #N" remains for a stack that did land in part. (owner, 2026-11-02)
- A session's memory of a stack seen in the queue, to say "#N was thrown out, the later ones left with it" once its entries are gone (SP54 as
  first drawn) — it misread a removal on github.com, was lost on reload, and an `UNMERGEABLE` entry read "Out of the queue" while GitHub still
  held it, with no action in the panel. (owner, 2026-11-03)
- Reading `RemovedFromMergeQueueEvent` to say why an entry left — worth adding only if the sentence is missed. (owner, 2026-11-03)

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
request open in the item is tall, so the entry shows where you are while collapsed. (2026-11-01, owner, picking SP10 of the design agent's
variants)

**Why.** Keeping the row's height keeps the list calm next to ordinary rows. Only an entry has pips, so it cannot be taken for a pull request,
and an issue with nested pull requests has its own number and no fold (SP11). The pips answer [D10](#d10)'s cost: where the trouble sits is
visible collapsed. Beyond 12 pull requests pips narrow.

**Rejected.**

- One line — a third less height, but the state is cut to fit and it breaks the rhythm of the list.
- Words only — no new element, but it cannot show where the trouble sits or where you are.

## D15

**When an entry's pull requests differ: assignees are the union, up to three faces and +N; labels and project fields are those all share, the
rest +N; milestone only when shared, otherwise "2 milestones"; size the sum; updated the latest.** (2026-11-01, design agent, SP12; owner
accepted)

**Why.** The row must stay one line of properties, and expanding shows the rest.

## D16

**A share of a stack on a board or in a group reads "2 of 4", and its pips show this share filled and the others hollow. A lone row or card
carries a small marker: icon, pips with this one tall, and its place ("3 of 4"), with no chevron.** (2026-11-01, owner, picking SP27; SP13, SP24,
SP26)

**Rejected.**

- A second edge behind the card — says "several" sooner, as decoration on a calm board.

## D17

**The map never goes away while walking. In a panel it sits above the content: at the top, as rows, a window of at most six for a long stack (one
before, two after, the rest folded into a line that says what they hold); once the content scrolls, it folds to one line of pips, place, what
blocks and the neighbours on `K` and `J`, and unfolds back at the top or on a click. In a modal it sits at the top of the side column, whole. On a
full page it is a column of its own on the left, whole.** (2026-11-01, owner: the panel unfolded at the top and folded when scrolled, and the left
column on a full page; SP30–SP32, SP33–SP36)

**Why.** `J` and `K` then change only what is highlighted, and every pull request opens unfolded at the top. The panel is short on height, so the
rows give way to the content once it is being read. On a full page the column reads as the stack's contents.

**Rejected.**

- A panel with only the one-line strip — what is next is only learned by going.
- A panel with only the rows — they take the content's room while reading.
- The full page's side column, like the modal — keeps one place for both, but the owner prefers contents on the left; the cost is 300 px of
  reading width.

## D18

**How far is a line in the panel's list, moved with `↑` and `↓`. Later ones stay dimmed below it and the button counts.** (2026-11-01, owner,
picking SP41)

**Why.** The usual merge gains no key. The line cannot skip, which is GitHub's own rule ([D11](#d11)).

With exactly one going, the merge is an ordinary one and the commit text is back (SP43). The first open pull request is the only one that can
go alone, so GitHub's unclear handling of titles ([D11](#d11)) does not arise.

**Rejected.**

- A "How far" line with its own key — one key more, and the list no longer shows the cut.

## D19

**When a stack is held, `⇧M` opens with the line at the last one that can land, and `⌘↵` lands those.** The panel says "2 of 4 can land" and who
holds the rest. (2026-11-01, owner, picking SP45)

**Why.** Same two keys, and it is what the map's "Merge 2 of 4" promises. Cost accepted: landing part of a stack by habit, softened by the amber
verdict and the count on the button.

**Rejected.**

- Nothing armed until `↑` picks a place — safer against habit, one key more every time.

## D20

**`X` on a collapsed entry selects it whole, and the count is of pull requests. `⇧J` crosses a collapsed entry in one step and an expanded one row
by row. `X` on a row inside selects that one, with a half mark on the entry.** (2026-11-01, design agent, SP28; owner accepted)

**Why.** Edits on an entry apply to its pull requests, so the count must say how many will change.

## D21

**A stack needing a rebase reads amber, all pips amber, with the sentence "Needs rebase · nothing can merge". When selected it shows "Rebase on
GitHub" on `⇧M`, and in the panel `⌘↵` opens GitHub. It keeps its place in the list.** (2026-11-01, owner, picking SP15; SP46)

**Why.** Amber, because nothing is wrong with the code and something must happen elsewhere; red stays for what is broken. `⇧M` already means "land
this", so no key is added. It is frequent, so it must not shout or reorder.

> **Not found:** a field saying that a stack needs rebasing, or why ([D8](#d8)). SP46 and SP47 tell a moved target from an earlier push; they need
> this settled in the live test.

> **Checked 2026-11-01 (live, a scratch repository):** no such field, but it can be worked out. After a push to the first pull request,
> the second one's `baseRefOid` stayed on the old commit while `baseRef.target.oid` moved, and GitHub refused merging it: "Stack needs
> to be rebased: PR #2's branch is not a linear descendant of PR #1's branch." After rebasing the later branches the two matched again.
> A moved target alone (the same mismatch on the first pull request) did not block: the whole stack merged with `squash`.

**Rejected.**

- The way out on every such row, selected or not — plainer, noisier for something this frequent.

## D22

**Link, add and dissolve are palette and item menu commands with no single keys, opening the merge panel's surface. Linking shows the order from
the branches, with each base, and there is nothing to arrange. Refusals githq can see from the branches appear before sending. Add lists pull
requests based on the last one's branch. Dissolving says per pull request who stays and who leaves.** (2026-11-01, design agent, SP70–SP79; owner accepted)

**Why.** They are rare, so they don't earn keys. GitHub links by chain, so a chosen order would be false.

## D23

**`↵` on an issue serving as a stack's header opens the issue; once the stack is expanded `J` goes on into it ([D26](#d26)). Two stacks under one issue each get a header one step
in, with their rows on a rail below it.** (2026-11-01, design agent, SP21, SP22; owner accepted)

**Why.** The issue is an item with content of its own, unlike a stack's entry. Two stacks are the one case [D12](#d12) leaves open: their own headers
make one more level than "no third level" suggests. It is rare.

## D24

**A merged entry goes purple and leaves at the next refresh. The toolbar's position counts the items `J` and `K` reach, each once, so it can exceed
the list's count of entries.** (2026-11-01, design agent, SP8, SP3; owner accepted; what it counts changed by [D26](#d26))

**Why.** `J` also steps through an expanded stack's pull requests ([D26](#d26)), and the count of entries is for the list ([D3](#d3)).

## D25

**In a panel the map is a bar pinned under the toolbar that never folds: the stack's name and one numbered square per pull request, each square
opening its pull request. A square has a faint tint of its state, a firmer outline and a crisp number; the open one gets a full-colour outline, a
bold number and a short mark under it. The rows sit at the top of the content, every pull request with none folded, and scroll away under the bar;
once they are out of view a chevron, which kept its place hidden, drops them over the content. K and J sit right after the neighbours' titles, in all
three ways an item opens.** (2026-11-02, owner, replacing the panel part of [D17](#d17); SP30, SP82–SP84, SP88, SP90, SP93)

**Why.** Folding the rows into a strip changed the panel's height as soon as the content scrolled, so the whole view jumped. A bar of fixed height
with the rows as plain content never moves anything. Pips without numbers made the place hard to read. A solid or strongly tinted open square lowered
the number's contrast; the mark keeps it, and takes no room, so nothing shifts while walking.

**Rejected.**

- The map folding to a one-line strip once the content scrolls (SP32) — the layout jumps on the first scroll.
- A window of six with the rest folded (SP31) — more clicking to see the stack.
- K and J at the right end of the neighbours' rows — the state beside them shifts as you walk. After the title, the row's spacer absorbs the key.
- K and J in a legend above the rows — one more line, and it doesn't say which row each key goes to.
- A merge button in the map's last line ("Merge 3 of 8 ⇧M", SP3, SP5, SP6, SP34, SP36, SP82, SP84; "Rebase on GitHub" in SP8) — not built: `⇧M`
  opens the merge panel from any pull request of the stack, and the map stays a map. Taken out of the screens to match the app. (owner,
  2026-11-09)
- A drawn two-line tooltip on a square (number, title, then "7 of 10 · Waiting for review", SP83 as first drawn) — the browser's own tooltip
  names it ("7: #67 Pause on rate limit"), and the rows say the state. (owner, 2026-11-09)

> **Built 2026-11-09 (PR #235):** the squares sit 6 px apart, not 3: they are 18 px, and WCAG 2.5.8 wants 24 px between the centres of
> targets that small. The same spacing as the review's stack strip.

- ‹ and › around the squares (SP89) — the squares are already the buttons, and the arrows take room from the name.
- Squares tinted, quiet or sharply outlined (SP85–SP87) — too strong, or a failing pull request stops standing out.
- The open square with a light ring (SP91), a thicker outline (SP92), or a stronger tint and a white number (SP94) — the owner preferred the mark.
- A one-sided accent border on the selected map row — reads as decoration; the fill alone marks it.

## D26

**`J`, `K` and the arrows step through what the list shows, in the same order with an item open or not. A collapsed stack is one step. An expanded
stack's entry is a step, and so is each of its pull requests. On a board a stack's card is one step, and once expanded each of its pull requests is a
step after the card. With an item open each step opens its item; on a stack's entry that is the pull request `↵` opens.** (2026-11-04, owner, replacing
the walk of [D9](#d9))

**Why.** The same keys walked over whole stacks with the panel closed and through a stack's pull requests with it open, so where a key went depended on
something that had nothing to do with the row. An expanded stack is now the one way into a stack: `→`, then `↓`. It costs one key, and the stack stays
expanded for the session ([D10](#d10)).

**Rejected.**

- `J` and `K` walking a collapsed stack's pull requests while an item is open (D9 as first decided) — the walk above.
- Passing over an expanded entry's own row while an item is open — one more difference between open and closed. The step can leave the panel on the same
  pull request, when the entry opens the first of its rows; that is accepted.

## D27

**The bar's chevron sits right after the stack's name, and a click anywhere on the bar outside the squares drops the rows over the content or closes
them. While the rows are in view the chevron is not there at all.** (2026-11-09, owner, changing the chevron of [D25](#d25); SP83, SP84)

**Why.** At the right end, after the squares and a divider, the hidden chevron left an empty gap of no visible use at the top of every pull request.
After the name nothing follows it but the spacer, so it shows without moving anything, and the whole bar is a bigger target than a 24 px button.

**Rejected.**

- The chevron as a button at the right end, keeping its place hidden (D25 as first decided) — the empty gap above.

> **Built 2026-11-09 (PR #235), owner's additions:** any scroll of the content, up or down, puts the dropped rows away, as do Esc, a click
> outside, a second click on the bar, opening a pull request and the rows coming back into view. With Animations on and no reduced motion
> they slide out from under the bar in 150 ms, ease-out, the bar never covered ([githq D38](../githq/DECISIONS.md#d38)); they go at once.
