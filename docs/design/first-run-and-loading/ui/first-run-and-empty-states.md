# Path: the first run, and screens that have nothing to show yet

Self-contained brief for the design agent. The decisions behind it are in
[the design's record](../DECISIONS.md); the screen-by-screen map of today's empty states in
[empty-states.md](../empty-states.md).

## Purpose

Someone signs in to githq for the first time. Today they choose which repositories and projects to track, then wait on a
"First download" page (screen G6) with a bar per repository and an "Open My work" button that unlocks once their own
issues and pull requests are in. That page goes. They land in the app at once, and the app itself has to say what is
still coming — without ever lighting up for the constant background refreshes githq runs once everything is in.

The same question — "is this really empty, or not here yet?" — runs through every screen, so this brief also covers
every screen and list that can show nothing: a filter that leaves nothing, a repository with no issues, a repository
GitHub won't show. Some of those states are designed already; others are a bare line of text, and a few say something
false.

## The user's task

"Let me in and show me my stuff. If something isn't there yet, tell me it's coming — don't make it look empty. If it's
really empty, tell me what you checked."

## Screens, in order

### 1. Choosing what to track (G2, and its variant offering saved settings, G11; on the Mac, G15)

What it asks and holds does not change. Two things do:

- **No step indicator.** With the download step gone it would show two steps, one of them done.
- **The top is the app's window strip.** On the macOS desktop app the window's close, minimise and zoom buttons sit over
  the top-left corner at a fixed point. Inside the app they sit in a 36px strip above the sidebar; on the sign-in screens
  today they sit in a 56px header with a border, so the bar around them jumps between screens. The choosing screen takes
  the same 36px strip. It stays a screen of its own — not inside the sidebar and status bar. On the web and on Windows
  there are no buttons over the page, but the screen should look the same.

"Track these" goes straight to where the user was heading: My work by default.

### 2. My work, seconds after signing in (G16, G17)

The one screen likely to be wholly empty right after sign-in. The user's own issues and pull requests are on their way
(groups: review requested, my pull requests, assigned, mentioned). Until the first of them arrives, the screen shows the
**still arriving** state (below) — not "Nothing on your plate". Rows appear as they come; groups still arriving keep
saying so in their place.

### 3. The status bar while things download (ES5–ES10)

The status bar runs along the window's bottom, one segment per surface: the sidebar's segment at the left, the screen's
segment under the list, the opened item's under its panel.

- **The left segment** (under the sidebar, normally GitHub's API allowance) takes over while any tracked repository or
  project is downloading: how many are downloading, items so far of the total counted, and roughly how long is left
  once that can be told — e.g. "Downloading 4 repositories · 1,240 of 8,000 · about 2 min". It is not a button. When
  everything has arrived it goes back to the allowance. Being offline, or refresh paused by the allowance, still takes
  the segment first. It is the **only** place that speaks of repositories downloading.
- **The sidebar's entries** show no download marker (today a percentage). An entry shows nothing where its count goes
  until its open items are in, then its count.
- **The screen's segment** says what is happening to that screen. A tracked repository whose open items are in but
  whose closed ones are still downloading says so, with how far — e.g. "Downloading closed issues · 1,200 of 4,000" —
  and not "Up to date". It says "Up to date" only when the repository is complete.
- **Nothing shows for background refresh** — not a poll, not a refresh that found changes and is fetching them. Those
  changes just appear in the list.

### 4. Every empty screen and list (ES1–ES4, ES11–ES25)

A screen with nothing on it says **why**, and there are four reasons:

1. **Still arriving** — githq will have the data and doesn't yet. Light, with a small animation; the owner's words for
   its tone: "fetching data", "crunching", "churning" — something that looks good and feels light.
2. **Nothing there** — the data is complete and holds nothing. Can be good news ("Nothing on your plate", "All files
   viewed").
3. **Filtered out** — there is data, but the filter, state or view on screen hides all of it. Names the filter and
   offers to clear it.
4. **Can't be read** — GitHub won't show it, or can't be reached: no access or gone, GitHub failing, the app offline,
   refresh paused by the API allowance until a time. **One pattern**, with one line naming the cause and the action that
   cause allows (open on GitHub, try again, or "it resumes by itself at 14:20").

Rules:

- **Never "nothing" while it is still coming or can't be read.** When several reasons hold, the first in this order
  wins: can't be read, still arriving, filtered out, nothing there. (Offline while arriving → can't be read, else it
  spins forever. Closed issues still arriving under the "Closed" filter → still arriving, not "nothing matches".)
- **Only when the screen has nothing.** With rows on screen, the status bar alone tells what is going on.
- **An empty group inside a list with other rows** keeps its quiet "Nothing here." line; its header says what it is.
- **One pattern per reason**, used on every screen; the words differ per screen.

Which screen can say which — *kept* means already designed and staying, **new** a state the screen doesn't have,
**fix** one that is wrong or a bare line today:

|Screen|Still arriving|Nothing there|Filtered out|Can't be read|
|-|-|-|-|-|
|My work (any filter, list or board, grouped by reason or repository)|first download; a group (**fix**: fixed "the search on GitHub takes a few seconds" line)|kept|a filter, or one group chosen in the sidebar (**fix**: bare "Nothing here.")|offline or failing before anything arrived (**new**)|
|A tracked repository's Issues, Pull requests|open items not in (**new**; today says "No issue matches. Try another state."); closed items not in, under a filter that shows them (**new**)|no issues / pull requests at all|the state filter|hidden, GitHub refusing (**new**)|
|A repository browsed without tracking it|first read|as tracked|the state filter|not shown (kept); failing, offline, paused (**new**)|
|A tracked project|the project not in (kept); its items not in (**fix**: today "has no items yet" with add actions)|"has no items yet" (kept)|a view or filter: list (kept), board (**fix**: bare paragraph); a view GitHub answers (kept)|hidden, failing (**new**)|
|A project not tracked|—|"Nothing in it concerns you" (kept)|—|—|
|Draft reviews|—|kept|—|—|
|A repository's Commits|first read (**fix**: bare "Loading commits…")|"No commits yet" (kept)|branch/tag filter (kept)|offline, paused, refused, failing (**fix**: one bare note)|
|Workflows section, a run, its log, code review|kept|kept|kept|kept|
|Broken workflows|kept|kept|—|every tracked repository unavailable (**fix**: blank today)|
|Settings' tracked repositories / projects|—|none tracked (**fix**: "0 tracked repositories" alone)|—|—|

## Screens in `githq.pen`

The first run is in "App · First sign-in and choosing what to track"; the rest in "App · Loading and empty states"
(letters `ES`). Decisions: [DECISIONS.md](../DECISIONS.md#d8) D8–D16.

- **G2, G4, G5, G10–G14** — the choosing screens, now under the app's 36px strip without a step indicator
  (`Track / Top bar` changed); **G15** the same on the macOS desktop app, window buttons in the strip.
- **G16** — My work seconds after "Track these", nothing arrived; **G17** — some groups in, others arriving.
- **G6** (the download page) and **G7** (the rejected "straight into the app" draft) are retired.
- **ES1** — the four patterns on a full screen, a list's group and a board column; **ES4** how still arriving moves.
  ES2 and ES3 (rejected directions) are deleted.
- **ES5** — what the left segment says while downloading (ES6, ES7 rejected and deleted); **ES8** who has it;
  **ES9** a tracked repository while its closed issues arrive; **ES10** the same, up to date.
- **ES11–ES13** — My work: a filter leaves nothing; one group chosen from the sidebar, empty; offline before anything
  arrived.
- **ES14–ES17** — a tracked repository before its open issues arrive; the Closed filter while closed issues arrive;
  a tracked repository GitHub won't show; an untracked repository with GitHub failing.
- **ES18–ES20** — a tracked project while its items arrive; its board when the filter leaves nothing; a tracked
  project GitHub won't show.
- **ES21–ES24** — Commits on their first read; Commits paused by the allowance; Broken workflows when no repository
  can be read; Settings with no repositories tracked.
- **ES25** — "can't be read": the title, line and action per cause.

## Failures that must be visible

- **A screen that can't be read must not look like it's loading.** Offline with nothing downloaded yet is the case that
  spins forever today.
- **A repository still downloading must not look empty**, nor offer "try another state".
- **A project still downloading must not offer to add items** as if it had none.
- Organisations hiding their private repositories from githq stay visible on the choosing screen (already designed).

## Technical constraints

- **Counts grow.** A repository's total is unknown before its first page, and its closed items are counted only once
  their download starts, so "of 8,000" can rise while it runs. Time left is known only after about five seconds of
  progress.
- **My work's total is not known in advance** — only which groups have arrived.
- **A project downloads all its items in one go**, with a count.
- **"No access" and "gone" look the same** from GitHub; one message covers both.
- **Offline, paused and failing are known app-wide**, and paused comes with the time it resumes.
- **Everything else on screen comes from a local copy**, so a screen with rows is never "loading" in the sense of this
  brief.

## Out of scope

- A "loading more" row at the end of a list (postponed).
- An opened issue's or pull request's parts fetched separately (comments, checks) and small lines inside panels and
  pickers ("No comments yet.", "Nothing matches" in the command menu).

## Questions this design should settle

1. The four patterns: their look, and how each reads on a full screen, in a list's group, and in a board column.
2. The still-arriving animation and words — light, not a spinner on a blank page.
3. Whether the still-arriving state shows numbers where they exist (a repository's "1,200 of 4,000") or leaves numbers
   to the status bar.
4. The left segment of the status bar under the collapsed sidebar (the rail), where only a few characters fit.
5. The cause line and action of "can't be read" for each cause.
