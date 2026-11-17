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

**Every command is defined statically and all definitions are exported from one module (split into files by area); a
place can only bind a defined command. Its id is a plain string, unique across the definitions, checked by a test.**
(2026-11-16, owner)

**Why.** The list of all commands, the settings screen and conflict checks need every command to exist without the
screen that offers it being mounted. Places pass the definition object itself ([D12](#d12)), so nothing looks a command
up by its id in code; the id's one job is the key the user's own keys are stored under ([D10](#d10)).

> **Checked 2026-11-16:** githq's `CommandRegistry` (`packages/app/commands/CommandRegistry.ts:48`) only knows the
> commands of mounted components (35 `useCommands` call sites). healed's doctor app (`packages/doctor-app/actions/`,
> added `c1b32c698`) splits a static `defineAction` constant from a `useAction(def, handler)` bound to a component's
> lifetime, but registers the definition only when a handler mounts, so it too has no list of all actions and
> resolves duplicate keys silently by usage rank (`ActionManager.ts:243`).

**Rejected.**

- Commands created at mount, as today in githq and in healed — no full list, no conflict detection, no rebinding.
- Definitions next to each feature with no collecting module — the full list then depends on what happens to be
  imported.
- A typed union of all ids — no code writes an id as a string, so it checks nothing
  ([history](history/DECISIONS.md#d2)).

## D3

**A definition declares where the command can be offered, so key conflicts are found from the definitions alone,
before a key is saved.** (2026-11-16, owner) How "where" is described: [D13](#d13).

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
rebindable. Each family is one definition (`Go to view 1–9`) whose binding receives the number and may name what the
number picks (`Go to "Backlog" view`).** (2026-11-16, owner)

**Why.** Rebinding them makes no sense; the number is the position on screen. They still run through the registry
([D11](#d11)), so each family needs a definition; one with a number is one row in the list of keys rather than nine.
The command menu shows the binding's name, since "view 3" says nothing.

> **Checked 2026-11-16:** `REPOSITORY_SECTION_KEYS` (`repository/RepositorySection.ts:21`), `FILTER_KEYS`
> (`myWork/MyWorkView.vue:153`), saved views (`projects/useProjectCommands.ts:71`), merge methods
> (`merge/MergePanel.vue:1579`).

**Rejected.**

- One rebindable command per number — nine entries in the settings nobody would change.
- Numbered keys registered by the screen with no definition — the one exception to every command having one.
- No definition for families at all ([history](history/DECISIONS.md#d9)) — they would stay outside the registry.

## D10

**The user's keys are kept in the settings that follow you between devices (the settings document of
[settings-sync](../settings-sync/DECISIONS.md#d7)).** (2026-11-16, owner) Proposed: only the keys a user changed are
stored, by command id, so a new default reaches everyone who did not change that command.

**Why.** Keys are a chosen preference that rarely changes, the kind settings-sync's rule syncs. With sync off they
stay in the browser, as every synced setting does.

**Rejected.**

- Keys on each device — a user who rebinds would have to do it again on every computer.

## D11

**Fixed keys that act on a screen (the numbers of [D9](#d9), `J`/`K` with the arrows as their other keys, the Escape
that closes a panel) are definitions too, marked `configurable: false`, and run through the registry's one listener.
Keys a control owns while focused (Enter in a field, Tab, Escape in a dialog) are not commands; the list of keys shows
them as one fixed section.** (2026-11-16, owner; the flag's name is the owner's)

**Why.** Today a list key is declared twice, a help-only stub and a separate listener, and the two can disagree;
with one definition and one listener, what the list of keys shows is what runs. It removes the ~18 separate window
listeners and every help-only stub.

> **Checked 2026-11-16:** separate `keydown` listeners on `window` in `utils/useRowSelection.ts:92`,
> `lists/ListView.vue:619`, `item/useItemArrangement.ts:487`, `workflows/WorkflowJobLog.vue:518`,
> `tracking/TrackedListView.vue:73` and others; the registry's own at `commands/CommandRegistry.ts:108`.

**Rejected.**

- The registry handling only configurable commands, fixed keys described for the list but run by their own listeners
  — keeps two places for one key, the problem this design starts from.

## D12

**The shape in code: `defineAppCommand({ id, title, icon, key, otherKeys?, places, priority?, configurable? })` in
`commands/definitions/*.ts`, all re-exported from one index; `bindCommand(definition, { run, when, unavailable,
detail, title?, icon?, options }, t)` gives the command a place offers, as a plain value a context menu can show too,
and `useCommands` registers a component's bound commands — only bound ones; buttons keep their own label and icon and take their key hint from a
helper, `:kbd="keyOf(definition)"`, which applies the user's key. A definition holds a translation key, translated
when shown. Its title is the command's general name, the one the list of keys shows; a binding's `title` (and `icon`)
may say what the command acts on there ("Untrack" for "Remove" in the tracked repositories) or which way a toggle goes
("Show as board"), and names what a numbered family picks ([D9](#d9)).** (2026-11-16, owner; titles of a place
2026-11-17, owner)

**Why.** Each part has one job from [D1](#d1): what a command is, what it does here. A hint read through the helper
replaces the ~150 hand-typed `kbd=` hints, so a hint cannot show a key that does not work, after a rebinding too.
Buttons often carry a label that depends on where they are (the merge panel's button is named after the merge
method), so the helper does not force the command's title on them. The command menu and the help sheet read better
naming what the command does on this screen, while rebinding still goes by the definition, so one general name there
is enough. A definition is a module-level constant, which cannot call a component's `t()`, and UI text is never
hardcoded (`translations` skill), so it holds the key and whatever shows it translates.

> **Checked 2026-11-16:** githq has one language, `APP_LANGUAGE = 'en'`
> (`packages/app/i18n/AppLanguageContext.ts:6`), so following a change of language is not a reason here.

**Rejected.**

- Hints typed on each button (`kbd="O"`) — today's state; they drift from the key that runs.
- `<CommandButton :command>` drawing name, icon and key from the definition and running it on click — forces the
  command's title on buttons named for their place ([history](history/DECISIONS.md#d12)).
- Only the definition's title, everywhere but a numbered family — "Remove" in the tracked repositories and "Show as
  board or list" say less than the screen knows ([history](history/DECISIONS.md#d12)).
- Splitting a definition wherever the words differ ("Untrack", "Remove pattern") — rebinding one would no longer move
  the other, and a toggle's two directions would be two commands on one key.

## D13

**"Where" is a place from a flat list: the whole app, or one kind of screen or panel (a list, an open item, a review,
a job log, the commit graph, the settings, …). A short hand-kept list names the places that can be on screen together
(a list with an item open beside it), each pair ordered with the place that keeps the keyboard first. Two commands
sharing a key conflict if they share a place or their places are on that list. A screen's command may take a key of an
app-wide command; the settings show it as "here, ⌘B does X instead of Y", not as a conflict. At runtime, of commands
that can run on one key, a screen's goes before the app's and the first place of a pair before the second: the same
list says what has the keyboard.** (2026-11-16, owner; the ordered pairs deciding at runtime 2026-11-16, owner; fixed keys never conflicting 2026-11-17, owner)

**Why.** The defaults rely on a screen taking an app-wide key (the review's `Mod+B` over the sidebar's), and screens
like a review are where single keys are worth most. Places that nest get the list with an item beside it wrong: the
item is narrower, so its `O` would be shown as deliberately taking the list's, yet the list keeps the keyboard
(`docs/design/githq/navigation.md`, `ListView.vue:58,757`), so the item's `O` never fires. That is a real conflict,
and the flat list with pairs reports it as one. One definition offered in two places of a pair (the list's and the
item's "Open on GitHub") is not a conflict, and the pair's order says which one runs. As `J`, `K`, `X` and the rest
of the list's keys move into the registry, one rule kept as data, and checked by the same test as the conflicts,
holds better than each screen choosing a section that happens to win. Two fixed keys never conflict: the check exists so that a key
the user chooses cannot silence another command, nobody rebinds a fixed key, and fixed defaults are made together, a
`when` deciding which runs (the list's Escape clears what is checked, then the item's closes it; the board's ←/→ step
between columns where the list's expand a stack).

> **Checked 2026-11-16:** before the registry ran these keys, the list kept them by handling them in its own window
> listener, outside the registry's section order (`lists/ListView.vue:619`); the item's `O` was in the `item` section,
> which that order puts before the list's `view`.

**Rejected.**

- Places that nest, one place inside several parents, conflict when "active together and neither contains the
  other" — calls the list-and-item clash a deliberate override, and needs data nesting does not hold
  ([history](history/DECISIONS.md#d6)).
- A key unique along the whole path from the app to the narrowest place — the review would lose `Mod+B`.
- Priority decided by nesting — wrong for a list with an item open beside it.
- Fixed keys checked like any other, with an exception for Escape and the board as a place of its own to keep the
  arrows apart — exceptions the check would keep growing ([history](history/DECISIONS.md#d13)).
- Places serving only the conflict check, with the registry's section order deciding at runtime and the list's keys
  given a section that wins — each screen would have to pick its section by which key should win, and the help sheet
  would head the list's keys under that section ([history](history/DECISIONS.md#d13)).

## D14

**A definition has a `priority` that orders the command menu: within each group, higher first, then the order
registered; while typing, the match decides and priority breaks ties.** (2026-11-16, owner) Proposed: a number,
default `0`.

**Why.** The owner sees the grouping changes first in a list's menu, before what matters more. It belongs to the
definition, like the title, since a command matters the same wherever it is offered.

**Rejected.**

- Order of registration alone — today's state; it puts whatever a component happens to register first on top.
