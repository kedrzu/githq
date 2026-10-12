# githq — brief for UI exploration

Hand this whole `ui/` folder to the design agent. This file is the shared context, and each other file is
one thing a user does in the app. Nothing outside this folder is needed.

## What we want from you

We want **several distinct design directions**, not one polished answer. Explore them freely. Invent things,
try layouts we didn't think of, push one direction to an extreme. The owner will look at them side by side
and pick what they like, so the most useful result is a set of directions that differ in ways that matter.
Three or four variations of the same layout are much less useful.

Nothing in these files prescribes layout, components, navigation structure or visual style. Where a file
lists what a screen must show, that is content and priority, not placement. If a path reads better as one
screen than as two, or a "screen" works better as an overlay or a panel, do that.

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
  that lives only in the project and belongs to no repository.
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
- **Your own edits are instant.** If GitHub rejects one (no permission, an item deleted meanwhile), the edit
  is undone and an error is shown. If two people edit the same thing, the last write wins.
- **GitHub has an hourly API allowance.** If it runs out, background refresh pauses until the allowance
  resets. Everything already loaded still works, and so do edits. The user should be able to tell that
  refresh is paused.
- **Code review is not in the app.** Diffs and line comments stay on github.com. One key opens the PR there.
- **There is no notifications inbox** in the first version.

## The paths

- [First sign-in and choosing what to track](first-sign-in.md)
- [Checking what's on my plate and acting on it](my-work.md)
- [Working inside a project](project.md)
