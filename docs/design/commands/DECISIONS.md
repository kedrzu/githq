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
before a key is saved.** (2026-11-16, owner) How "where" is described: [D6](#d6).

**Why.** A shared key is only a conflict between commands that can be active at once (`1` for a repository section
and `1` for a My work filter never are; the sidebar's `Mod+B` and the review's file-list `Mod+B` are). The
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

## D6

**"Where" is a place from a short fixed list (the app, a list, an open item, a review, a job log, the commit graph,
the settings, …); places nest, and one place can sit in several others (an item open beside a list, or full
screen). Two commands sharing a key conflict only if their places can be active together and neither contains the
other. A command in a narrower place may take a key a wider one uses; the settings show it as "here, C does X
instead of Y", not as a conflict. Places serve only conflict checks: which command gets a key at runtime is still
decided by who has the keyboard.** (2026-11-16, owner)

**Why.** The defaults already rely on narrower screens taking keys (the review's `Mod+B` over the sidebar's), and
modes like a review or a job log are where single keys are worth most. Priority by nesting alone gets the list with
an item open beside it wrong: the list keeps the keyboard there (`docs/design/githq/navigation.md`), so `J`, `K` and
`O` act on the selected row though the item is the narrower place. Runtime focus already handles that today
(`ListView.vue:58,757` strips `O` and `Enter` from the row's commands).

**Rejected.**

- A key unique along the whole path from the app to the narrowest place — every app-wide key would be unusable on
  every screen, and the review would lose `Mod+B`.
- Priority decided by nesting alone — wrong for a list with an item open beside it.

## D7

**Creating an issue has no app-wide single key.** (2026-11-16, owner)

**Why.** githq is more than an issue tracker; creating an issue is not its primary function everywhere, so it does
not earn one letter on every screen. It stays in the command menu.

> **Checked 2026-11-16:** today it is `NEW_ISSUE_KEY = 'C'` in the app section
> (`packages/app/commands/CommandTypes.ts:35`), and the landing page advertises `C`
> (`packages/app/landing/LandingFeatures.vue:27-32`).

**Rejected.**

- `C` everywhere, as in issue trackers — overstates issues in an app that is also pull requests, reviews and Actions.

## D8

**Default keys of app-wide commands use no bare letter, only keys with a modifier and symbols (`Mod+K`, `?`, `,`,
`Mod+B`); letters belong to screens. The rule binds the defaults, checked in the module of definitions; a user may
bind a letter to an app-wide command.** (2026-11-16, owner)

**Why.** A screen's letter then never takes anything app-wide, so the settings rarely have to say a key does
something else here, and a new app-wide letter is refused by the rule rather than argued case by case
([D7](#d7) was such a case).

> **Checked 2026-11-16:** with `C` gone ([D7](#d7)), the app-wide keys are `APP_KEYS` =
> `{ commandMenu: 'Mod+K', help: '?', settings: ',', sidebar: 'Mod+B' }` (`packages/app/commands/CommandTypes.ts:32`).

**Rejected.**

- Judging each app-wide letter on its own — the case of `C` would recur.
- Forbidding the user a letter on an app-wide command — their keys are theirs; the settings show where it is taken.

## D9

**Numbered keys that pick the n-th of what a screen shows (views `1`–`9`, repository sections `1`–`4`, My work
filters `1`–`3`, merge methods `1`–`3`) are fixed, like the keys of [D4](#d4): shown in the list of keys, not
rebindable.** (2026-11-16, owner)

**Why.** Rebinding them makes no sense; the number is the position on screen. It also keeps numbered families out
of the definitions, which would otherwise need one command per number or a parameter.

> **Checked 2026-11-16:** `REPOSITORY_SECTION_KEYS` (`repository/RepositorySection.ts:21`), `FILTER_KEYS`
> (`myWork/MyWorkView.vue:153`), saved views (`projects/useProjectCommands.ts:71`), merge methods
> (`merge/MergePanel.vue:1579`).

**Rejected.**

- One rebindable command per number — nine entries in the settings nobody would change.
- One command with a number parameter — a mechanism for a family that does not need rebinding.

## D10

**The user's keys are kept in the settings that follow you between devices (the settings document of
[settings-sync](../settings-sync/DECISIONS.md#d7)).** (2026-11-16, owner) Proposed: only the keys a user changed are
stored, by command id, so a new default reaches everyone who did not change that command.

**Why.** Keys are a chosen preference that rarely changes, the kind settings-sync's rule syncs. With sync off they
stay in the browser, as every synced setting does.

**Rejected.**

- Keys on each device — a user who rebinds would have to do it again on every computer.
