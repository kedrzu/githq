# Path: working inside a project or a repository

Read `README.md` in this folder first.

**Status:** designed in Direction D (projects D4, D5; repository J1–J3; states K6–K9).

## Purpose

The user maintains something planned in a GitHub Project: a release, a roadmap, the backlog of an
open-source library. They come here to see the state of the whole thing and move work along, not just
their own part. A tracked repository is the same idea without a project: all of its open issues and PRs.

## The user's task

"Show me this project the way I think about it (by status, by iteration, by whoever is on it), let me
triage and move things quickly, and don't make me wait."

## Settled since the first brief

- **List and Board are both in the first version,** for projects, repositories and my work alike.
- **The tabs are the project's saved views from GitHub,** e.g. "Current sprint", "Backlog", "By assignee".
  githq shows each one with its own filter, grouping, sort and layout.
- **Changing the view in githq is local.** Changing grouping, sort, layout or row properties in githq is
  saved on this device only and never written back to GitHub, because the view is shared with the whole
  team. The tab must then show that it is **modified locally**, with a way to reset it to GitHub's version.
- **Some filters may not be understood yet.** githq evaluates a view's filter locally. A filter it can't
  evaluate yet is answered by GitHub instead, which takes a moment. The user should see that this view is
  slower and why. This is rare.
- **No "moved by someone".** D4 shows "moved by sofiab · just now". GitHub doesn't reliably tell us who
  changed a field, so use "just now" alone, or another way of showing recent movement.
- **Row field.** Each project has one field that represents it in rows outside the project (see
  [my work](my-work.md)). By default it is the single-choice field named "Status". The user can change it in
  the project's display options.
- **One menu per project or repository, wherever it is named** (designed in R1–R3). Right-clicking a
  tracked repository in the sidebar opens its menu: open it, its issues or pull requests, a new issue in it,
  open it on GitHub, copy its link, stop tracking it. A tracked project gets the same in the sidebar: open
  it, a new issue in it (where the user may update the project), open it on GitHub, copy its link, stop
  tracking it. The title of a repository's or a project's view is a button that opens that same menu, as
  the item reference opens the item menu (M1).

## What happens, in order

1. **Choosing a project or repository,** from the sidebar or the command menu.
2. **Seeing its items.** A project's items come from several repositories (issues, PRs and draft issues),
   each with the fields **this project defines**. A repository's items are its open issues and PRs, with
   GitHub's own properties and no project fields of their own. If an item belongs to projects, it shows
   their row fields as in [my work](my-work.md).
3. **Shaping the view**: saved views as tabs, filters, grouping, sort, List or Board.
4. **Triage and moving work**: edit any field, assign, label, close. Edit several items at once. Write
   draft issues straight into the project.
5. **Opening an item** works as in [my work](my-work.md).

## Still to design

- **Repository view.** It is the same list or board as a project, without project fields. The interesting
  parts:
  - What does it group by when there is no project? Labels, assignee, milestone, issue type, issues versus
    PRs?
  - How does the user get from a repository to the projects its issues live in?
  - Show a tracked repository, and also what happens when the user opens an untracked one from the command
    menu (it shows what concerns the user and points to Settings, J3).
- **A view modified locally, and resetting it.**
- **A view whose filter is answered by GitHub** rather than locally.
- **A project with no single-choice field at all,** where there's nothing to group a board by.
- **An empty project, and an empty saved view.**
- **An edit rejected by GitHub inside the project,** e.g. changing a label on an item from a repository the
  user can't edit, while its project fields still work.

## Fix in the existing screens

- Remove "moved by sofiab" from D4 (see above).
