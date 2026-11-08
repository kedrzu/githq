# Empty states: what there is today

What every screen shows when it has nothing to show, as found in the code on 2026-11-06, grouped by why it is empty.
The design that follows from it is in [the story](README.md); this chapter is the map it was drawn from.

A screen can be empty for four reasons:

- **still arriving** — githq is going to have the data and does not yet;
- **nothing there** — the data is complete and holds nothing (good news included: "nothing on your plate", "all files
  viewed");
- **filtered out** — there is data, but the filter, state or view on screen hides all of it;
- **can't be read** — GitHub won't show it (no access, gone), refuses, fails, the app is offline, or paused by the API
  allowance.

## Where the reason is told well

- **My work** with every group in and empty: "Nothing on your plate", "Nothing needs you right now", "Nothing is waiting
  on others", with what was checked and a way on (`packages/app/myWork/MyWorkEmpty.vue`).
- **A project's view matching nothing** (list layout): "Nothing matches “{view}”" with the view's filter and "Show all
  items" (`packages/app/projects/ProjectView.vue:473`). A view GitHub has to answer: "GitHub is answering this view".
  Still arriving: "{name} is still arriving", with how many open items so far (`ProjectPage.vue:638`).
- **A repository's Workflows section**: not read yet, Actions switched off, GitHub refused, no workflows — each its own
  state (`packages/app/workflows/RepositoryWorkflowsView.vue:107`).
- **A workflow run and its log**: gone, failed, no jobs, still running, too large, never ran
  (`packages/app/workflows/WorkflowRunView.vue:111`, `WorkflowRunLogPane.vue:102`).
- **Code review**: gone, failed, paused, filter matches nothing, all viewed, no changes, reading
  (`packages/app/review/ReviewView.vue:1713`).
- **Choosing what to track** with no repositories: "You don't have any repositories yet" and what still works
  (`packages/app/tracking/TrackingChooser.vue:693`).

## Where it says the wrong thing

- **A tracked repository still downloading** shows "Nothing here — No issue of this repository matches. Try another
  state." The arriving state exists only for an untracked repository (`packages/app/repository/RepositoryPage.vue:164`).
- **A tracked project whose items are still downloading** shows "{project} has no items yet" with actions to add items
  (`packages/app/projects/ProjectView.vue:407`) once the project itself is in.
- **The shared list's arriving line** is always "Still arriving. The search on GitHub takes a few seconds more."
  (`packages/app/lists/ListView.vue:1453`) — also during a first download, and also when GitHub fails or the app is
  offline, so it can spin forever.
- **An untracked repository GitHub fails on, or offline**: no state of its own; the list shows the arriving line or
  "Nothing here" (`packages/app/repos/BrowsedRepositories.ts`, `BrowsedStatus` has no failing or offline).
- **Broken workflows when every tracked repository is unavailable**: neither empty state, only the "Can't tell" section
  (`packages/app/workflows/BrokenWorkflowsView.vue:59`).

## Where it is a bare line or nothing

- **My work narrowed to one group from the sidebar**: the group header and "Nothing here." (`ListView.vue:1504`), never
  the designed empty state.
- **An arrived empty group** anywhere in the shared list: "Nothing here." (`ListView.vue:1504`, board `:1591`).
- **Commits**: "Loading commits…" and "GitHub can't be asked for the commits right now…" as plain notes; offline,
  paused, refused and failing are one message (`packages/app/commits/CommitGraphView.vue:775`).
- **A project's board matching nothing**: the detail text as a bare paragraph, no title (`ProjectView.vue:511`).
- **Settings' tracked repositories and projects with none**: the heading "0 tracked repositories" alone
  (`packages/app/tracking/TrackedListView.vue`).
- **Draft reviews' and other pages' signed-out guard** renders nothing — not reachable signed out in practice.

## Small lines inside panels and pickers

Not screens: an item's comments ("Loading comments…", "No comments yet."), reviews, checks omitted when none, pickers'
"Nothing matches", the command menu's "Nothing matches" / "Asking GitHub…", the review conversation's "Reading…". They
tell their reason in a line, which suits their size.

## Offline

No list's empty state mentions being offline; it is said only in the status bar, the commit graph's foot, Settings'
updates, the merge panel and the new-issue dialog.

## What each screen can say

The reasons each screen has to tell apart, under [the four reasons and their order](DECISIONS.md#d6). A reason marked
**new** is one the screen does not tell today; **fix** is one it tells wrongly.

|Screen|Still arriving|Nothing there|Filtered out|Can't be read|
|-|-|-|-|-|
|My work (any filter, list or board, grouped either way)|the user's work not in yet; a group not in yet (**fix**: the fixed "search takes a few seconds" line)|"Nothing on your plate" (kept)|a filter, or one group from the sidebar (**fix**: bare "Nothing here.")|offline or GitHub failing before it arrived (**new**)|
|A tracked repository's Issues, Pull requests|open items not in (**new**, today "Try another state"); closed items not in under a filter that shows them (**new**)|no issues or pull requests at all|the state filter|GitHub hides it, refuses its changes (**new** on the list; told in the status bar today)|
|An untracked repository being browsed|first read|as tracked|the state filter|not shown (kept); failing, offline, paused (**new**)|
|A tracked project|the project not in (kept); its items not in (**fix**: "has no items yet" with add actions)|"has no items yet" (kept)|a view or filter, list (kept) and board (**fix**: bare paragraph); a view GitHub answers (kept, it is arriving)|hidden, failing (**new**)|
|An untracked project|—|"Nothing in {name} concerns you" (kept)|—|—|
|Draft reviews|—|"No draft reviews" (kept)|—|—|
|A repository's Commits|first read (**fix**: bare note)|"No commits yet" (kept)|a branch or tag filter (kept, a line)|offline, paused, refused, failing (**fix**: one bare note; one pattern with a cause line, not four designs)|
|A repository's Workflows, a run, its log, code review|kept|kept|kept|kept|
|Broken workflows|kept|kept|—|every tracked repository unavailable (**fix**: blank)|
|Settings' tracked repositories and projects|—|none tracked (**fix**: "0 tracked repositories" alone)|—|—|
