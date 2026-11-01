# githq — brief for UI exploration

Hand this whole `ui/` folder to the design agent. This file is the shared context, and each other file is
one thing a user does in the app. Nothing outside this folder is needed.

## Where the design stands

The exploration round is done. The owner chose **Direction D** in `githq.pen`: its overview is the frame
**"App · Overview — Direction D"** (`I7akNj`), and each aspect of the app has its own frame named `App · …`.
It is one app with three independent switches:

- the sidebar is expanded, or collapsed to a rail;
- every list (my work, a project, a repository) can be shown as List or Board, with the same toolbar;
- an item opens in a panel, a modal or a full page, and all three show the same item view.

Work from here builds on Direction D. Keep its components and its feel. Within it you are still free to
explore. Where a new screen has more than one reasonable shape, show two or three variants side by side,
and the owner will pick.

`githq.pen` is laid out top to bottom, one top-level frame per aspect, so a new screen goes into the frame of
its aspect, and a new aspect gets a new frame:

- **`App · …`**: overview, components, toolbar; My work, project, repository, pull request, merging; the menus; first
  sign-in, creating an issue, states, freshness.
- **`Desktop · …`**: screens only the desktop app has.
- **`Landing — …`**: the landing page, desktop and mobile, and its motion storyboard.
- **Brand**: `Logo — git/hq`, app icons, OpenGraph images.
- **Archive**: `Archive · Direction A/B/C` and the logo exploration. Rejected work: don't build from it.

The logo is settled. The brandbook is the frame **"Logo — git/hq"** in `githq.pen` (frame `S5J7kt`): the
wordmark `git/hq` and the sygnet `/hq`, in Geist 700, black or white only, with violet (`$accent`) on the
slash alone. Use one of them in a given place, never both side by side. Place them through the components
`Brand / Wordmark` and `Brand / Sygnet`. The frame "Logo — exploration archive (DO NOT USE)" holds rejected
directions: never take a symbol, typeface or colour from it.

Nothing in these files prescribes layout or visual style. Where a file lists what a screen must show, that
is content and priority, not placement.

## The product

githq is a web app for working with GitHub Issues, Pull Requests and GitHub Projects as a task manager. It
is for people who run open-source projects, and for small teams who already live on GitHub. They want one
place that shows everything they are working on across all their repositories, and they want it to feel like
Linear: instant, dense but calm, and driven entirely from the keyboard. The owner uses Linear at work for
exactly that feel, and finds GitHub's own views uncomfortable as a task manager. Borrow the **feel** of
Linear, not its screens.

githq is a client for GitHub, not a new tracker:

- **It shows only what GitHub has.** It adds no fields, statuses, priorities or conventions of its own. There
  is no built-in Todo / In Progress / Done.
- **Workflow fields come from GitHub Projects.** A GitHub Project can define fields such as "Status",
  "Priority", "Iteration", "Estimate", or anything else. githq shows and edits those fields exactly as
  that project defines them. Different projects have different fields, and a project may have no "Status"
  at all.
- **An issue outside any project is just a GitHub issue.** It is open or closed, with labels, assignees, a
  milestone and so on.
- **Every edit is a normal GitHub edit,** visible on github.com right away.
- **githq may compute views from GitHub data,** such as "needs me" or counts, as long as nothing new is
  stored. Each such view has a precise definition, given in the path that uses it.

## Principles the design should serve

- **Instant.** Navigation never waits on the network, so don't design spinners into ordinary navigation.
  Data comes from a copy kept in the browser.
- **Keyboard-first.** Everything is reachable without the mouse. A command palette, single-key actions on
  the selected item, and moving through lists with the keyboard are expected. Show the user what the keys
  are without cluttering the screen.
- **Calm and dense.** Lists that show a lot without shouting, few colours, and no chrome that doesn't earn
  its place. GitHub label colours are user-chosen and often loud, so decide how much of that to let in.

## What the data looks like

The things in the app, and what GitHub gives us about each.

- **Repository**: owner/name, private or public.
- **Issue**:
  - repository and number, title, body (GitHub-flavoured markdown), author;
  - open or closed (closed as "completed" or "not planned");
  - assignees, labels (each with its own colour), milestone, issue type (e.g. Bug, Feature, set per
    organisation);
  - parent issue and sub-issues, with progress (e.g. 3 of 5 done);
  - "blocked by" and "blocking" relationships to other issues;
  - comments, reactions, created and updated times;
  - pull requests linked to it ("this PR closes #12").
- **Pull request**: everything an issue has, plus:
  - draft, open, merged or closed;
  - source and target branch;
  - **status**, which means CI checks (passing, failing or running), review state (approved, changes
    requested or waiting for review, and from whom) and whether it can be merged (e.g. conflicts);
  - size (lines added and removed, files changed);
  - issues it closes.
- **Project** (GitHub Projects): a title, owned by a user or an organisation. It holds items from many
  repositories, and its own fields, of these types:

  - single choice from a list of options,
  - text,
  - number,
  - date,
  - iteration (a time-boxed cycle with a start date and length).

  Each item in a project is an issue, a pull request or a **draft issue**. A draft issue is a title and body
  that lives only in the project and belongs to no repository. Archived items are hidden.

  A project may also have **saved views**, defined by its maintainers on GitHub. Each has a name, a filter, a
  grouping, a sort and a layout (table or board). githq shows them as they are.
- **Permissions are known up front.** githq knows the user's role in each repository, so it offers only the
  edits the user is allowed to make. In someone else's open-source repository a contributor can comment and
  create issues, but not set labels, assignees or milestones.
- **What a project field change tells us:** what the new value is and when it was set. It does **not**
  reliably tell us who set it, so don't show "moved by someone".
- **The user**: login, avatar, the organisations they belong to.

## Where the data comes from, and what that means for the screens

- **The app keeps two kinds of data:**

  - **What concerns me**: issues and PRs anywhere on GitHub that I wrote, am assigned to, am asked to
    review, or am mentioned in. These can come from repositories I don't own, e.g. a PR I opened on
    someone else's open-source project.
  - **What I track**: repositories and projects I chose to follow, copied in full, including other
    people's issues.

  Anything else on GitHub isn't in the app until the user tracks it.
- **Reading is instant** after the first sign-in. The first sign-in has to download data, which takes from
  seconds up to a minute or two for big repositories. That is the only place a real loading state belongs.
- **Other people's changes arrive with a delay.** Changes made on github.com, or by others, show up within
  tens of seconds to about a minute. The app refreshes in the background, and the user may want a quiet hint
  of how fresh the data is.
- **How fresh is what I see?** Because almost everything comes from the local copy, every large surface — a
  whole list (my work, a project view, a repository) and an opened item — shows whether what it displays is
  current. Not every row. A surface can be: fresh (checked in the last ~30 seconds); being checked right now;
  stale (offline, a failing request, or refresh paused by the API allowance); partial (still downloading);
  answered by GitHub rather than locally (slower); or carrying the user's own edits that GitHub hasn't
  confirmed yet, or one that failed. Most of the time it's fresh, so the marker must be quiet then and
  noticeable only when something is off.
- **Your own edits are instant.** If GitHub rejects one (no permission, an item deleted meanwhile), the edit
  is undone and an error is shown. If two people edit the same thing, the last write wins.
- **GitHub has an hourly API allowance.** If it runs out, background refresh pauses until the allowance
  resets. Everything already loaded still works, and so do edits. The user should be able to tell that
  refresh is paused.
- **Code review is not in the app yet.** Diffs and line comments stay on github.com, and one key opens the PR there.
  Merging is in the app: [its brief](../../pr-merge/ui/merge-a-pull-request.md).
- **There is no notifications inbox** in the first version.

## The paths

- [First sign-in and choosing what to track](first-sign-in.md)
- [Checking what's on my plate and acting on it](my-work.md)
- [Working inside a project or a repository](project.md)
- [Creating an issue](new-issue.md)
- [The desktop app: signing in with a code, and updating](desktop.md)
