# Retired decisions

Each retired form under its original ID, oldest first. Never edited after it is written.

## D2

Retired in part 2026-11-16: the typed id union went; the rest holds in [D2](../DECISIONS.md#d2).

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

## D6

Retired 2026-11-16, replaced by [D13](../DECISIONS.md#d13).

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

## D9

Retired in part 2026-11-16: numbered families are now one definition each with a number; the rest holds in
[D9](../DECISIONS.md#d9).

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

## D12

Retired in part 2026-11-16: `<CommandButton>` replaced by a key helper; the rest holds in [D12](../DECISIONS.md#d12).

**The shape in code: `defineAppCommand({ id, title, icon, key, places, configurable? })` in
`commands/definitions/*.ts`, all re-exported from one index; `useCommand(definition, { run, when, unavailable,
detail, options })` in the component that knows what it does; `<CommandButton :command>` draws a button's name, icon
and key chip from the definition with the user's key applied. A definition holds a translation key, translated when
shown.** (2026-11-16, design agent's proposal, not opposed by the owner)

**Why.** Each part has one job from [D1](#d1): what a command is, what it does here, how it looks. A button reading
its key from the definition replaces the ~150 hand-typed `kbd=` hints, so a hint cannot show a key that does not
work. A definition is a module-level constant, which cannot call a component's `t()`, and UI text is never
hardcoded (`translations` skill), so it holds the key and whatever shows it translates.

> **Checked 2026-11-16:** githq has one language, `APP_LANGUAGE = 'en'`
> (`packages/app/i18n/AppLanguageContext.ts:6`), so following a change of language is not a reason here.

**Rejected.**

- Hints typed on each button (`kbd="O"`) — today's state; they drift from the key that runs.

## D13

Retired in part 2026-11-16: places now also decide which command runs a shared key; the rest holds in
[D13](../DECISIONS.md#d13).

**"Where" is a place from a flat list: the whole app, or one kind of screen or panel (a list, an open item, a review,
a job log, the commit graph, the settings, …). A short hand-kept list names the places that can be on screen together
(a list with an item open beside it). Two commands sharing a key conflict if they share a place or their places are
on that list. A screen's command may take a key of an app-wide command; the settings show it as "here, ⌘B does X
instead of Y", not as a conflict. Places serve only these checks: which command gets a key at runtime is decided by
what has the keyboard.** (2026-11-16, owner)

**Why.** The defaults rely on a screen taking an app-wide key (the review's `Mod+B` over the sidebar's), and screens
like a review are where single keys are worth most. Places that nest get the list with an item beside it wrong: the
item is narrower, so its `O` would be shown as deliberately taking the list's, yet the list keeps the keyboard
(`docs/design/githq/navigation.md`, `ListView.vue:58,757`), so the item's `O` never fires. That is a real conflict,
and the flat list with pairs reports it as one.

**Rejected.**

- Places that nest, one place inside several parents, conflict when "active together and neither contains the
  other" — calls the list-and-item clash a deliberate override, and needs data nesting does not hold
  ([history](history/DECISIONS.md#d6)).
- A key unique along the whole path from the app to the narrowest place — the review would lose `Mod+B`.
- Priority decided by nesting — wrong for a list with an item open beside it.
