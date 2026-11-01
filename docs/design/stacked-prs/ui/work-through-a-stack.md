# Working through a stack

## Purpose

A stack is a chain of pull requests where each builds on the one before it, and they land on one branch together, the first one
first. Agents and teammates deliver larger work this way, so one change is three or four pull requests, and several such changes are
open at once. Today githq lists them as unrelated rows, mixed with each other. This path makes a stack one piece of work everywhere
in the app. The user arrives from any list: My work, a repository or a project, as a list or a board.

## The user's task

"Show me the pieces of work, not their parts. Let me go through one stack from its first pull request to its last, then the next stack,
and land it when it's ready." They never read the first pull request of one stack and then the first of another.

## Screens, in order

1. **A list holding stacks.** A stack is one collapsed entry among ordinary rows. It answers: *which piece of work is this, and how far
   along is it?*
2. **The entry expanded,** with its pull requests first to last.
3. **An opened pull request in a stack.** `Enter` on the entry opens the first open pull request not yet approved, otherwise the first
   open one. There is no screen for a stack as such. Next to the pull request's content is a map of the whole stack, in all three
   ways an item opens: panel, modal, full page. It answers: *where am I in this stack, and how does the rest stand?*
4. **Moving on.** `J` and `K` in an opened item already go through the list; they now go through a stack's pull requests one by one,
   collapsed or not, and carry on into the next entry. `O` opens the current one on github.com, where code is read and reviewed for now.
5. **The merge panel for a stack,** with `⇧M`, then `⌘Enter`.
6. **Managing:** linking pull requests into a stack, adding one on top, dissolving. Commands in the palette and menus, with what they
   need to show.

## What's on each screen

**The entry,** by importance:

- Its name: the title of the issue the stack closes, otherwise the title of its first pull request and the count. GitHub gives a stack
  a number and no title.
- Its state, worked out from its pull requests: how many are ready, and what blocks the first one that cannot merge ("2 of 4 ready, #36
  blocks"). Trouble in the third pull request is only visible here while collapsed, so this has to be plain.
- How far it is, once some have landed.
- Its repository, where the list spans several. Pull requests in a stack are always in one repository.

**The expanded rows** are the app's ordinary pull request rows with their own state. Earlier ones landed are not listed; the entry says so.

**The map,** by importance: each pull request in the stack first to last, with number, title and state, merged ones included; which one
is open; whether it can be opened with one key. It also says what stops the stack merging, and offers the merge.

**The merge panel** is the existing one ([its brief](../../pr-merge/ui/merge-a-pull-request.md)), and its design stays. For a stack it
differs:

- It names every pull request that will land, with each one's state, before the merge.
- From an entry it starts on the whole stack; from one pull request, on everything up to it. The user can change how far. Later pull
  requests cannot be chosen without earlier ones.
- With two or more there is no commit text: each lands under its own title. The method is one for all.
- The commit email is not available.

## The rules behind them

- **Same group, one entry.** Pull requests of a stack that land in one group of a list share one entry. Without grouping, or by repository,
  that is the whole stack.
- **Spread over groups.** On a board by Status, or a list grouped by label, the stack has an entry in each group, saying "2 of 4". One alone
  in a group, or the last open one of a stack, is an ordinary row marked as part of a stack. An item with two labels is listed under each,
  as it is today.
- **My work by reason:** always one entry, in the first of the four reasons any of its pull requests has.
- **My work, under an issue:** if a pull request in the stack closes an assigned issue, the whole stack sits under that issue, and the issue
  serves as the stack's header, with no third level. Two stacks under one issue each need their own header.
- **Filters:** if any pull request matches, the group's members show, those not matching de-emphasized.
- **Sort:** the entry's place comes from its best matching pull request; inside, the order never changes.
- **Counts** count entries, as nested pull requests in My work aren't counted today.
- **Collapsed by default.** `→` and `←` expand and collapse. An expanded stack stays so for the session and is collapsed after a reload.
- **Edits on an entry** (assignee, label, a drag on a board) apply to the pull requests in that entry, as a selection of several does today.
- **Order and words:** first to last, top to bottom, because that is how they are read, and "earlier" and "later". GitHub draws the opposite
  and says "below"; the merge brief uses "below" too, so replace it here.

## States

- **Ready:** everything can merge.
- **Held by an earlier one:** "2 of 4 ready, #36 blocks". A later pull request may be green itself. On its own row it stays green; the panel
  explains.
- **Partly merged:** later pull requests carry on, GitHub retargets and rewrites them by itself, and a moment later they have fresh checks running.
- **Stack needs rebasing:** after a push to an earlier pull request, or the target branch moved. Nothing can merge until "Rebase stack" is done,
  which only exists on github.com. Common, not a corner case.
- **Mid-stack pull request closed:** everything later is blocked until the stack is dissolved and linked again.
- **Draft inside a stack:** blocks whatever comes after it, like any unready pull request.
- **Copy not complete yet:** fewer pull requests in githq than the stack's size. Must not read as ready.
- **Being merged:** a stack takes longer than one pull request; the existing "being merged" state applies to every pull request going.
- **In a merge queue:** the stack enters as one group. If a pull request is thrown out, the later ones go with it.
- **Someone else's stack:** a colleague asked for review of two of four. The entry is whole, and what is asked of the user shows.
- **A chain nobody linked:** pull requests based on each other that aren't a stack on GitHub stay ordinary rows. An opened one offers to link it.

## Failures that must be visible

- **Partway failure:** GitHub's docs disagree on whether earlier pull requests stay landed. The user sees, per pull request, what is true after
  githq reads the stack again. Never "all" or "none" by assumption.
- **Refused for being rebased or held:** with the reason and the way forward.
- **Someone pushed meanwhile:** the merge is cancelled, deliberately, as for one pull request.
- **An edit on an entry refused for one of its pull requests:** only that one rolls back, and the user sees which.
- **Linking refused:** the branches aren't a chain, or a pull request is already in a stack.
- **Dissolving leaves something behind:** merged and queued pull requests stay in the stack on GitHub.

## Hand-offs to github.com

"Rebase stack", and reading and reviewing the code. Reordering or removing one pull request does not exist on GitHub either: it is
dissolving and linking again.

## Technical constraints

- Everything an entry shows is computed from the local copy, so it is instant and may be slightly old. There is no spinner on any of this.
- Merging is asynchronous. Nothing reads as merged until GitHub confirms it.
- Bypass exists only for the lowest unmerged pull request, not a whole stack.
- Auto-merge for stacks: GitHub says both "not supported" and "rolling out". Draw it as offered when GitHub offers it.
- A stack has at most 100 pull requests on paper; ten is a large one in practice, as a guess, and two is common.
- `Shift+J` and `Shift+K` already extend a selection in a list. GitHub uses them for moving in a stack; githq does not need to.

## Questions this design should settle

- How an entry reads as a piece of work without being mistaken for a pull request or an issue, and how it differs from an issue with nested
  pull requests. Both can sit in one list.
- What an entry shows of its pull requests' properties when they differ: assignees, labels, milestone.
- How the marker looks on a lone row, and "2 of 4" on a board's card.
- Where the map goes in each of the three ways an item opens, and how it behaves in a stack of two and of ten.
- How the panel lets the user choose how far, without adding a key to the usual whole-stack merge.
- How selection works with entries: what `X` selects, and how `⇧J` runs across a collapsed entry.
- How the stack that needs rebasing reads in the list, since it is frequent and blocks everything.
- Where the link, add and dissolve commands surface, and how linking shows the order that will result.
