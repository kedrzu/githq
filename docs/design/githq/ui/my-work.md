# Path: checking what's on my plate and acting on it

Read `README.md` in this folder first. This is the main path. It is the reason the app exists and what a
user does several times a day.

**Status:** designed in Direction D (screens D1–D3 and D6, E1–E4, PR view F1–F4, states K1–K5).

## Purpose

The user opens githq in the morning, or between two other things, to answer "what needs me right now?"
across all their repositories, and then to deal with some of it without leaving the keyboard.

## The user's task

"Show me everything that's mine or waiting on me, let me open any of it instantly, and let me do the small
things (reassign, relabel, close, reply, move in a project) in a keystroke or two."

## What "my work" contains

These rules are settled. The screens must agree with them, including every count.

- **Contents.** Open issues and open pull requests from anywhere on GitHub, in four groups:
  1. **Review requested**: PRs where my review is requested.
  2. **My pull requests**: open PRs I opened.
  3. **Assigned to me**: issues assigned to me.
  4. **Mentioned**: issues and PRs that mention me.
- **Each item appears once,** in the first of these groups that applies.
- **A PR of mine that closes an issue in "Assigned to me"** is shown nested under that issue, and nowhere
  else. If the issue it closes isn't in my work, the PR is an ordinary row in "My pull requests".
- **Counts are top-level rows.** Nested PRs don't count. The count next to each group in the sidebar
  equals the count in the list, and "My work" in the sidebar is the sum of the four.
- **Grouping.** By reason (the four groups above, the default) or by repository ([D22](../DECISIONS.md#d22),
  screen D6): one group per tracked repository in the sidebar's order, rows showing just `#number`, and a
  last group "Other repositories" (not tracked) for everything else, whose rows keep `owner/repo#number`.
- **Filters:**
  - **Needs me**: review requested from me, plus my PRs with failing checks, changes requested or
    conflicts, plus issues assigned to me.
  - **Waiting on others**: my PRs waiting for review or with checks still running.
  - **All**.
- **Project status in a row.** Every project has one "row field", by default its single-choice field named
  "Status". If an item is in several projects, the row shows the row field of the first of them in the
  sidebar order, plus "+1", "+2" and so on for the others. The item view shows every project with all its
  fields. In the current D1, issue webapp#1187 is in Platform Q4 and Bug triage, so its row should read
  "In progress +1".

## What happens, in order

1. **My work**, as defined above.
2. **Moving through it**: keyboard up and down, the filters, grouping and sorting.
3. **Opening an item.** The issue view exists in Direction D. **The pull request view is still to
   design.** It shows the same sections as an issue (title, body, properties, projects, comments), plus:
   - **Checks**: overall state, and the list of checks with each one passing, failing or running. A failing
     check links to its log on github.com.
   - **Reviews**: who is requested, who approved, and who requested changes. For each reviewer, the latest
     state.
   - **Branches**: source into target. Whether it is a draft.
   - **Mergeability**: ready, blocked by failing checks, blocked by missing reviews, or has conflicts.
     A PR that is ready is merged from here: [the merging brief](../../pr-merge/ui/merge-a-pull-request.md).
   - **Size**: lines added and removed, files changed.
   - **Issues this PR closes.**
   - **Code review** happens on github.com. One key opens the PR's "Files changed" there.
4. **Acting on it**, from the list or from the opened item:

   - change assignees, labels or milestone;
   - close or reopen (completed or not planned);
   - set a project field;
   - comment;
   - add the item to a project.

   For a PR, the user can additionally request reviewers and mark a draft as ready for review.

   Right-clicking an item, or a selection, opens a context menu with the actions that fit it (designed in
   L1–L4): an issue gets its project fields, assignees, labels, milestone, type and close as completed or
   not planned; a PR gets request review, draft or ready for review, "Review files on GitHub", copy branch
   name, merge and close. The menu offers only what the user may do in that repository and says in
   one line what is missing and why. For a selection it offers only what applies to every selected item.
   Every entry shows its single-key shortcut, so the menu also teaches the keyboard.
   An opened item offers the same menu from its reference in the toolbar (`fitloop/webapp #1187 ▾`
   is the trigger, designed in M1–M2), minus the entries that only make sense from a list ("Open", "Open as full page").
   ⌘. opens it from the keyboard. In both menus a submenu's chevron sits right after its title, not at the
   far edge, so the shortcut column needs no empty space on the right.
5. **Back to the list**, with the selection preserved, and on to the next item.
6. **Jumping anywhere** with the command menu (designed in E1–E4).

## States to design

Only the first of these is new content. The others can be small, but must exist.

- **An edit rejected by GitHub** (e.g. no permission to label in someone else's repository). The change
  is undone and the user sees which edit failed and why. **Must be visible.** Show it once for a single
  item and once for a multi-item action where 1 of 3 failed.
- **Refresh paused** because the hourly API allowance ran out: when it resumes. Data and edits still
  work. Calm, but visible.
- **Nothing on my plate**, overall and for "Needs me". It's a good state, not an error.
- **Still downloading** on the first sign-in: the groups that already arrived are usable.
- **An item from an untracked repository** (already marked "not tracked" in D1): what "track this
  repository" from here looks like.

## Inconsistencies to fix in the existing screens

- The counts in D1 and D2 don't follow the rules above. The sidebar says My work 11, My pull requests 4,
  Mentioned 3, but the list shows 2 / 3 / 5 and has no Mentioned group.
- The row of webapp#1187 shows one status although the issue is in two projects (see "Project status in a
  row" above).
