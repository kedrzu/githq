# Projects

githq shows GitHub Projects with the views, fields and iterations they have on GitHub. A project you track opens as a
list or a board, and you can set its fields, write draft issues and add issues to it without leaving githq.

## Open a project

- **The sidebar** lists the projects you track, under **Projects**.
- **The command menu** (<kbd>⌘</kbd> <kbd>K</kbd>, or <kbd>Ctrl</kbd> <kbd>K</kbd> on Windows and Linux) finds a
  tracked project by its name or its owner, and its saved views by their names.
- **An address.** githq uses GitHub's addresses of a project, such as `/orgs/acme/projects/4` or
  `/users/octocat/projects/2/views/3`.

A project you don't track shows only the items that concern you, and points you to Settings to track it. See
[Choose what to track](../getting-started/choose-what-to-track.md#tracked-and-not-tracked).

## Views

A project's saved views from GitHub are tabs at the top. Each brings what it has on GitHub: its filter, its grouping, its
order, its layout and the fields it shows. A roadmap view, which githq doesn't have, shows as a list.

You can change a view's layout, grouping, order and fields in githq. The tab is then marked **modified locally**, and
**Reset** puts back GitHub's version. These changes stay on this device: githq never writes them back, so the view your
team shares on GitHub stays as it is.

### List and board

**List** shows the items in groups, one under another. **Board** shows a column per group. <kbd>Shift</kbd> <kbd>V</kbd>
switches between them.

A board needs a field to make its columns from: a single-select field, such as Status, or an iteration field. A project
with neither shows as a list and says so.

### Grouping and order

A view can be grouped by **Repository**, **Milestone**, **Assignees**, or one of the project's fields. A single-select
field gives a group per option, in the project's order. An iteration field gives a group per iteration, with its dates,
and marks the one running now as **current**.

The order is **GitHub's order**, the order of the project on GitHub, unless the view sorts by a field, the title or
another property.

## Filters

A view's filter comes from GitHub, written in GitHub's filter syntax, such as `status:Todo,Done -label:bug`. githq
shows its terms under the toolbar and applies it to the items on your device.

When githq can't work out a term itself, it asks GitHub to run the view's filter: the tab and the term carry a cloud,
**answered by GitHub**. Until GitHub answers, githq waits rather than show unfiltered items.

When nothing matches a view, it says so, with two ways out: **Show all items**, or **Clear filters here**, which clears
the filter on this device only. **Reset** brings it back.

## Fields

Rows and cards show the values of the fields the view shows: a single select with its colour, an iteration, a number, a
date or text.

Open an item, and its **Projects** card lists every field of each project it is in, with its value. Where you may
update the project, click a value to change it. Three fields have keys of their own, on a list's selected row and on an
opened item:

|Key|Field|
|-|-|
|<kbd>S</kbd>|Status|
|<kbd>P</kbd>|Priority|
|<kbd>I</kbd>|Iteration|

githq finds Status and Priority by the names GitHub's templates give them, as single-select fields. An item in several
projects uses the first one.

On a board, drag a card to another column, or press <kbd>Shift</kbd> <kbd>→</kbd> or <kbd>Shift</kbd> <kbd>←</kbd>, to set
the field the columns stand for.

### Row field

A project can show one field next to its items everywhere else in githq, in My work and in repositories, such as
`In progress`. Choose it in the view's display options, or with **Row field…** in the command menu. It is kept on this
device.

## Add to a project

Where you may update the project:

- **A new issue.** Press <kbd>C</kbd> on the project's screen. The issue is created in a repository you choose and
  added to the project. **New issue** at the end of a group, or the bottom of a column, adds it with that group's value.
- **A draft issue.** **New draft issue** at the end of a group, or the bottom of a column, opens a line for a title.
  <kbd>Enter</kbd> adds the draft with that group's value and leaves the line open for the next; <kbd>Esc</kbd> closes it.
- **Existing issues.** **Add existing issues to…** in the command menu lists the issues on your device. Pick several in
  a row.
- **From an item.** **Add to project…** in an item's menu, or **Add to project** on an opened item.

::: info
githq shows a draft issue, but doesn't edit it. Editing a draft and turning it into an issue happen on GitHub for now.
:::

## The project's menu

Click the project's title on its screen, or right-click it in the sidebar, for its menu: its views, **New issue**,
**Open on GitHub**, **Copy link**, **Settings** and **Stop tracking**. A tracked project's settings hold its
**Tracking** block, with **Untrack**.
