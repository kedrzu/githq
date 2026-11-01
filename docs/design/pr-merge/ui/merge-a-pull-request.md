# Merging a pull request

## Purpose

githq shows whether a pull request can be merged, and today sends the user to github.com to do it. This path
brings the whole merge into githq. The user arrives from a pull request they have open, from a row in a list
(My work, a repository, a project), or from the command palette. Often they arrive with one thing on their mind:
this is done, finish it.

## The user's task

"Merge this the way this repository merges things, now, and tell me if it actually happened." Nothing a repository's
way of working asks for at this moment may send them back to github.com, apart from the two hand-offs below.

## Screens, in order

1. **The pull request's merge standing.** It already exists in the opened item: a verdict ("Ready to merge", "Can't
   merge yet"), checks, reviews, conflicts, branches and size. It gains the way into merging. Its note saying that
   merging happens on GitHub goes away.
2. **The merge panel,** opened with `Shift+M` from the opened pull request, the list or the command palette. It
   starts on the repository's default method and the commit text GitHub proposes, so a usual merge is `Shift+M` and
   then `⌘Enter`. This second key is the only confirmation. It answers one question: *can I merge this now, and how
   will it land?*
3. **While it is being merged.** The panel can be gone by now and the user elsewhere in the app.
4. **After.** Merged, in a queue, waiting for auto-merge, or refused.

From a list, once a merge has been sent, the list moves on to the next row. Pull requests are merged one at a time;
there is no merging of a selection.

## What's on the panel

By importance:

- Whether it can be merged now and, if not, what holds it back.
- The checks, with **required** ones told apart from the rest. A failed check that is not required does not stop the
  merge, and a failed required one does. Each check links to its log on github.com.
- The method: merge commit, squash or rebase. Only those this repository and target branch allow are offered. Often
  there is just one, and our own repository allows only squash.
- The commit title and message, which differ by method. GitHub proposes them; the user may edit them.
- The commit email, when GitHub offers a choice: squash by the pull request's author with several verified addresses,
  or a merge commit. Never for a rebase. Without a choice it should not take up room.
- Auto-merge, the merge queue and bypassing requirements, in the states below.

**Not in the panel:** ordinary commands, available from the palette and the item's menu with their own shortcuts:
update the branch (by merge or by rebase), delete or restore the branch, revert a merged pull request, re-run GitHub
Actions checks, take out of the queue. They still need a place where the user finds them at the right moment, for
example "update branch" next to "this branch is behind".

## States

What the primary action is depends on the pull request and the repository:

- **Ready:** merge. Sent at once.
- **Requirements not met, auto-merge allowed:** enable auto-merge, choosing the method and commit text now. Once it is
  on: who enabled it, with what method, and how to turn it off.
- **Requirements not met, and the user may bypass them:** merge past the requirements. It is deliberately separate
  from the usual merge and never the default. It must say what is being skipped. It is not possible for every user or
  every rule.
- **Target branch uses a merge queue:** add to the queue. The method comes from the queue's configuration, and any
  commit text is ignored, so neither can be edited. The user may also jump the queue, which rebuilds everything in
  progress in it. Once queued: position, state (queued, waiting for checks, mergeable, unmergeable), estimated time.
- **Part of a stack:** merging also merges every open pull request below it in the stack. It must say so and show which
  ones, before the merge. A chosen commit email is not available here.
- **Conflicts:** cannot merge. The way forward is github.com's editor.
- **Behind the target branch, and the branch requires being up to date:** update the branch, then merge.
- **Draft:** mark ready for review first.
- **Mergeability not known yet:** GitHub computes it in the background and can say "unknown" for a moment, or after the
  target branch moved.
- **Being read:** the panel opens instantly from what githq holds. Rulesets, proposed messages and fresh status arrive
  a moment later, and things may change under the user's eyes: a method disappearing, a check turning red. `⌘Enter`
  already works during this, and unedited commit text then becomes GitHub's default.
- **Being merged:** GitHub has accepted the request and finishes in the background. The pull request reads as being
  merged everywhere it appears, and never as merged until GitHub confirms. The rest of the app stays usable. Usually
  short, and longer for a stack.
- **Merged:** with the follow-ups: delete or restore the branch, revert. The repository may delete branches by itself.
- **The user cannot merge here:** GitHub has no field saying so directly. Without write access in the repository
  githq knows up front and does not offer it. Otherwise it finds out from GitHub's refusal.

## Failures that must be visible

- **Refused**, with GitHub's reason. If the panel is still open it stays, with the edited text intact.
- **Refused after the user moved on:** they have to learn about it wherever they are now, and be able to go back.
- **Someone pushed in the meantime:** the merge is cancelled, deliberately. The user should understand nothing was
  merged and that there is a new commit to look at.
- **Method not allowed:** possible when sent before the rulesets arrive.
- **No answer in time:** githq stops asking and the regular refresh settles it. The pull request must not read as
  merged, and the user should know the outcome is not known yet.
- **Page reloaded during a merge:** the "being merged" state is gone. The pull request shows what GitHub last said
  until the next refresh. Should a merge seem still open, sending it again is what the user might try.
- **Possibly:** a pull request changing `.github/workflows` refused for lack of a permission of githq's, which would
  need signing in again. Not confirmed yet; treat it as one more refusal with a reason.

## Hand-offs to github.com

Cannot be done from githq, so they link out: the editor for resolving conflicts, re-running checks that do not come
from GitHub Actions, and GitHub's "Rebase stack" button.

## Technical constraints

- A merge cannot be undone; revert creates a new pull request. So it does not appear merged optimistically, unlike every
  other edit in githq, which shows instantly.
- Refresh runs in the background, so anything shown may be slightly old. The panel re-reads on opening; while it is open
  it is not assumed to update live.
- After a merge GitHub may also close linked issues and delete the branch. These reach the screen with the next read.
- There is no number of required approvals in the API: approvals are shown without "of N".

## Questions this design should settle

- Is the panel a part of the opened item's merge standing, or its own surface over any screen? It has to work from a list
  without opening the item.
- How to tell required checks from the rest without adding noise when everything is green.
- How to show "being merged" on a row, in the opened item and in the panel, and how a late refusal reaches someone on
  another screen.
- How far the commit text is visible by default, given that the usual merge does not touch it and the text can be long
  (ours are full pull request descriptions).
- How bypass reads so that it cannot be taken for the usual merge.
- Where the ordinary commands surface at the moment they matter.

## The screens

In `githq.pen`, frame **"App · Merging a pull request"** (`LLr2k`). The numbers are the frame's. Where there are variants,
the recommended one comes first.

|Question|Answer in the frame|Variants|
|-|-|-|
|The panel's form|Its own surface over any screen: PM1a, PM2a|Inside the row or the standing (PM1b, PM2b), a tray (PM1c, PM2c)|
|Required checks without noise|One line while green, a row with a tag when off: PM4a|Two lines always (PM4b); all open: PM4c|
|"Being merged"|Row PM37, item PM33, panel PM24, stack PM24b, status bar PM32a|Panel leaves on accept (PM32a) or stays (PM32b)|
|A late refusal|Toast, status bar and row: PM35||
|Commit text|Title and one line: PM3a; editing: PM3d|Folded (PM3b), always open (PM3c)|
|Bypass|Own red zone and chord: PM12a|Armed with a key (PM12b)|
|Ordinary commands|Beside the reason (PM20, PM26), the palette and menus: PM39||

The states: ready PM5–PM7, being read PM8–PM9, auto-merge PM10–PM11, nothing to offer PM13, queue PM14–PM16, stack
PM17–PM18, conflicts PM19, behind PM20, draft PM21, unknown PM22, can't merge here PM23, merged PM26, PM34. The failures:
refused PM25, PM35, head moved PM27, method PM28, no answer PM29, PM36, reload PM30, permission PM31. The standing in each
state: PM38.

Open with the owner, and not settled by the screens:

- **Stacks** have moved to [their own design](../../stacked-prs/ui/work-through-a-stack.md), which also settles `⌘Enter` before
  the read and the commit text.
- **The commit email when bypassing.** It needs GraphQL and bypass needs REST (D5), so PM12 has none. The brief excludes it
  only for a stack.
- **What bypass really skips.** `viewerCanMergeAsAdmin` is one boolean, so "Skips" lists what is unmet, and GitHub can
  still refuse a rule the user may not bypass.
