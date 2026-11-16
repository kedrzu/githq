# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the decision's ID alone, so
`DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired decisions, the journal and notes from
reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history they link to.**
Reopening a rejected option is right when its premise changed; repeating it without knowing it was rejected is not.

## D1

**A command is the unit a user rebinds; its id, title, icon, keywords and default key belong to its definition,
never to the place that offers it.** (2026-11-16, owner)

**Why.** The owner's brief: merge is the same command wherever it is run from, with the same key, icon and menu
entry. The test for whether two offerings are one command is whether rebinding one should move the other: "Open on
GitHub" on an issue, a repository and a workflow run is one; comment and retry, both `R` today, are two.

A place supplies only what depends on it: `run`, `when`, `unavailable`, `detail`, and a picker's `options` /
`children` (today's fields of `Command`, `packages/app/commands/CommandTypes.ts:68`).

> **Checked 2026-11-16:** "Open on GitHub" is built ~10 times (`item/useItemArrangement.ts:469`,
> `lists/useItemCommands.ts:128`, `lists/ListView.vue:973`, review, workflow run, workflows, repository, project,
> `CantBeRead.vue`, `settings/ChangelogView.vue:113`); the changelog's uses `ArrowUpRight` where the others use
> `Github`, and 25 `.loc.yaml` files carry an `openOnGitHub` key. Merge is wired in `ListView.vue:719`,
> `commands/useEditCommands.ts:373`, `ItemRow.vue:385,396` / `StackRow.vue:286` hints, and `merge/MergePanel.vue`.

**Rejected.**

- One command per place offering it (`item.openOnGitHub`, `list.openOnGitHub`, …) — today's state; rebinding would
  have to be repeated per place and the hints drift.

## D2

**Every command is defined statically, with a typed id, and all definitions are exported from one module (split into
files by area); a place can only bind a defined command.** (2026-11-16, owner)

**Why.** The list of all commands, the settings screen and conflict checks need every command to exist without the
screen that offers it being mounted.

> **Checked 2026-11-16:** githq's `CommandRegistry` (`packages/app/commands/CommandRegistry.ts:48`) only knows the
> commands of mounted components (35 `useCommands` call sites). healed's doctor app (`packages/doctor-app/actions/`,
> added `c1b32c698`) splits a static `defineAction` constant from a `useAction(def, handler)` bound to a component's
> lifetime, but registers the definition only when a handler mounts, so it too has no list of all actions and
> resolves duplicate keys silently by usage rank (`ActionManager.ts:243`).

**Rejected.**

- Commands created at mount, as today in githq and in healed — no full list, no conflict detection, no rebinding.
- Definitions next to each feature with no collecting module — the full list then depends on what happens to be
  imported.

## D3

**A definition declares where the command can be offered, so key conflicts are found from the definitions alone,
before a key is saved.** (2026-11-16, owner) How "where" is described is open.

**Why.** A shared key is only a conflict between commands that can be active at once (`1` for a repository section
and `1` for a My work filter never are; the global new-issue `C` and the review's line-comment `C` are). The
settings screen has to tell the user before saving, and no screen is mounted there.

**Rejected.**

- Learning where a command lives only at runtime from who mounted it — a conflict would surface only when the key is
  pressed, and the first command in priority order would silently win.

## D4

**Commands with a key a user can rebind include list movement and row keys (`J`, `K`, `X`, `O`); the arrow keys,
Enter, Escape, Tab and the keys a text field or dialog form owns while focused are fixed control behaviour, shown
in the list of keys but not rebindable.** (2026-11-16, owner)

**Why.** Those fixed keys behave the same across the web and are what the platform's controls do; making them
commands would mean routing focus-level behaviour through the registry for no user who asked. `J`/`K`/`X`/`O` are
githq's own choices, the kind a user may want to change.

> **Checked 2026-11-16:** list keys are declared twice today, once as a help-only `Command` with no `run` and once
> in a separate listener: `lists/ListView.vue:954-1020` vs `:619`, and likewise `CommitGraphView.vue:326`,
> `TrackedListView.vue:66`, `WorkflowAlertsBlock.vue:143`, `item/useItemArrangement.ts:453`.

**Rejected.**

- Every key a command, arrows and Escape included — rewrites focus handling into the registry; no case needs
  rebinding them.

## D5

**The word stays "command"; the function that defines one is not named `defineCommand`.** (2026-11-16, owner)
Proposed: `defineAppCommand`.

**Why.** The command menu, its public docs (`packages/docs/src/using-githq/command-menu.md`), the design (githq D36)
and the code already say command. `defineCommand` is `@nzyme/ioc`'s singleton function service, used in
`services/RenderMarkdownCommand.ts:17`.

**Rejected.**

- "Action" — in githq Actions means GitHub Actions, which has its own screens and design (`docs/design/actions/`).
