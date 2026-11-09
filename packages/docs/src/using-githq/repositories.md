# Repositories

A repository's screen holds its issues, its pull requests, its commits and, for a repository you track, its GitHub
Actions workflows. It opens for any repository you can see on GitHub, tracked or not.

## Open a repository

- **The sidebar** lists the repositories you track, under **Repositories**, each with its count of open items.
- **The command menu** (<kbd>⌘</kbd> <kbd>K</kbd>, or <kbd>Ctrl</kbd> <kbd>K</kbd> on Windows and Linux) finds a
  tracked repository by name. Type `owner/name` to open one you don't track, or choose **Search repositories…** to
  search all of GitHub.
- **An address.** githq uses GitHub's addresses: `/owner/name/issues`, `/owner/name/pulls` and `/owner/name/commits`
  open the matching section, and `/owner/name/actions` the workflows of a tracked repository. `/owner/name` opens the
  section you were on last, Issues the first time.

## Sections

The sections are tabs beside the repository's name, each on a number key:

|Key|Section|
|-|-|
|<kbd>1</kbd>|**Issues**|
|<kbd>2</kbd>|**Pull requests**|
|<kbd>3</kbd>|**Commits**|
|<kbd>4</kbd>|**Workflows**, only in a repository you track|

In a tracked repository, Issues and Pull requests show their count of open items, and Workflows the count of broken
workflows.

::: tip
**Settings → Display → Repository layout** chooses between **Tabs**, the default, and **Column**: a column of the
repository's own beside the sidebar, with its sections, the projects its items live in and, on Commits, its branches and
tags.
:::

## Issues and pull requests

Both sections are lists of the repository's items with GitHub's own properties.

- **State**: **Open** by default, **Closed**, or **Open and closed**. **Filter by state…** in the command menu does the
  same.
- **Group**: by **Milestone** (the default), **Assignee**, **Author**, **Status**, **Label**, **Issue type** (issues
  only) or **None**. A pull request's status is its stage, such as **Waiting for review**, **Needs work** or **Ready to
  merge**.
- **Layout**: **List** or **Board**, switched with <kbd>Shift</kbd> <kbd>V</kbd>.

Each section keeps its own state, grouping, order, layout and properties, for this repository, on this device.

On a board, drag a card to another column, or press <kbd>Shift</kbd> <kbd>→</kbd> or <kbd>Shift</kbd> <kbd>←</kbd>, to
change its milestone, label, assignee or issue type, where your role allows it. A card can't move to another status or
author: those aren't values you set.

Under the toolbar, githq lists the projects the listed items live in, each a way to that project. A row shows the
[row field](./projects.md#row-field) of each project it is in, such as its status.

Moving, opening and editing items work as in My work: see
[Open an item](./my-work.md#open-an-item) and [Act from the list](./my-work.md#act-from-the-list). A stack of pull
requests is one entry here too.

## Commits

Commits shows the repository's history as a graph, in any repository you can see, tracked or not. Each row has the
commit's branches and tags, its headline, the pull request it came from, its CI mark, its author and its age. Older
commits load as you scroll.

|Key|What it does|
|-|-|
|<kbd>J</kbd> / <kbd>K</kbd>|Next or previous commit|
|<kbd>Enter</kbd>|Open the commit's details|
|<kbd>B</kbd>|Find a branch or tag|
|<kbd>P</kbd> / <kbd>Shift</kbd> <kbd>P</kbd>|Go to the first or second parent|
|<kbd>Shift</kbd> <kbd>Enter</kbd>|Open the commit's pull request|
|<kbd>O</kbd>|Open the commit on GitHub|
|<kbd>Esc</kbd>|Close the details|

The details, at the right of the graph, show the full message, the author, the parents, the branches and tags pointing at
the commit, its pull request and its checks. They follow the cursor as you move.

**Branches and tags** lists the default branch first, then branches and tags, newest first. Type to filter them;
choosing one scrolls the graph to its commit.

## Workflows

Workflows lists every GitHub Actions workflow of a tracked repository, grouped by how it stands: **Broken**, **Pull
requests only**, **No alerts**, **Passing**, **Not known yet** and **Disabled**. Each row shows its last runs and how
long it has been broken or passing.

- <kbd>J</kbd> and <kbd>K</kbd> move; <kbd>Enter</kbd> opens a broken workflow's latest failed run, or unfolds any other
  workflow's runs under its row.
- A run opens on its own page in githq: its jobs beside the selected job's log. The log opens at the first error.
  <kbd>/</kbd> or <kbd>⌘</kbd> <kbd>F</kbd> searches the whole log, folded steps included.
- **Re-run failed jobs** is in the command menu on a run's page.
- <kbd>P</kbd> or **Alert settings** opens the repository's workflow alerts.

**Broken workflows**, in the sidebar while any workflow is broken, gathers the broken workflows of every tracked
repository: **New** for those broken in the last 24 hours, **Ongoing** for the rest.

### Workflow alerts

A workflow failing on the default branch marks the repository broken: a red mark in the sidebar, and one more in the
Broken workflows total. A run started by a pull request never does. In the repository's settings, under **Workflow
alerts**, you can switch the default branch off, or add branch and tag patterns such as `release/*` or `v*` that raise
alerts too. The Workflows section shows every workflow and run either way.

## Tracked or only browsed

A repository you don't track opens in the same screen, with a **not tracked** chip by its name and how much of it githq
has read, such as `120 of 3412`. githq reads more as you scroll to the end of the list; on a board, choose **Read
more**. Workflows is not shown.

To track it, open the command menu on its screen and choose **Track repository**, the last line of the repository's
group. [Choose what to track](../getting-started/choose-what-to-track.md#tracked-and-not-tracked) explains the
difference and how to stop tracking.

## The repository's menu

Click the repository's name on its screen, or right-click it in the sidebar, for its menu: its sections, **New issue**,
**Open on GitHub**, **Copy link**, and while you track it **Settings** and **Stop tracking**. On any screen that belongs to the repository, the
command menu offers the same under the repository's name, all but **New issue** (press <kbd>C</kbd> instead) and **Stop
tracking**. There, the settings are called **Repository settings**.

## Repository settings

A tracked repository has settings of its own, at GitHub's address of a repository's settings, `/owner/name/settings`:

- **Tracking**: that it is tracked, when it last synced, how many of its open items this browser holds, and
  **Untrack**.
- **Workflow alerts**: which branches and tags raise alerts. See [Workflow alerts](#workflow-alerts).

Open them from the repository's menu, or from its row in **Settings → Repositories**. <kbd>Esc</kbd> goes back.

## Open on GitHub

**Open on GitHub** in the repository's menu opens the repository on github.com. githq doesn't show a repository's code:
an address githq doesn't show, such as a file in the repository, opens on github.com directly.
