# Journal

## 2026-11-16

- Owner's brief: actions and keys feel inconsistent: overlapping, duplicated, illogical keys. Goal: every action a
  user can take, by key or from the command menu, has one definition (id, default key, icon, title) collected in one
  exported place; places wire a handler and visibility to it. Uses: a list of all actions, a hint of the keys
  available on the current screen, and settings where keys can be rebound. "Merge" is the same action wherever it is
  run from: same key, icon and menu entry. Out of scope: classifying the existing actions and resolving their
  duplicates; that happens per action during implementation.
- Explored githq: a `CommandRegistry` already exists (`packages/app/commands/`), but each component builds its
  `Command` object inline while mounted, so title, key and icon live at the registration, not in a definition.
  Beside it ~18 window keydown listeners, ~40 template `@keydown` handlers, ~150 hand-typed key hints; list keys
  (J/K/Enter/O/X) are help-only stubs whose real handler is a separate listener. "Open on GitHub" is defined ~10
  times with two icons. Key priority is the order of `COMMAND_SECTIONS` (selection > item > view > repository > app).
- Explored healed doctor app (`packages/doctor-app/actions/`, now unused): static `defineAction` constants, a
  `useAction(def, handler)` bound to a component's lifetime, `execute(def)` from any trigger. An action exists only
  while mounted, so no list of all actions and no conflict detection; no enabled/visible; untyped string ids.
- Naming: "action" collides with GitHub Actions in githq; "command" is the app's existing word (command menu, D36,
  public docs) but `defineCommand` is taken by `@nzyme/ioc`. Raised with the owner, not settled.
