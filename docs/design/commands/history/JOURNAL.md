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
- Owner accepted all recommendations: a command is the unit a user rebinds, its title/icon/key in the definition
  (D1); static typed definitions collected in one module (D2); definitions declare where they can be offered so
  conflicts are found before saving (D3); J/K/X/O rebindable, arrows/Enter/Esc/Tab/field keys fixed (D4); keep
  "command", define function not `defineCommand` (D5). README, DECISIONS written; all folded into the story.
- Open: how "where a command can be offered" is described and whether a narrower command may shadow a wider one's
  key; one command offered by two places at once; numbered families (1–9); where user keys are stored.
- Owner: a narrower place may take a wider one's key (shown in settings, not a conflict); places only for conflict
  checks, runtime keyboard focus decides priority (D6). Owner: creating an issue gets no app-wide single key, githq is
  more than an issue tracker (D7). Folded into README. Raised: should app-wide commands use letters at all.
- Owner: app-wide default keys use no bare letter (D8, rule on defaults only). Owner: numbered keys (views 1–9,
  sections, filters, merge methods) are fixed, not rebindable (D9). Owner: user keys live in the synced settings
  document (D10; storing only changed keys by id is the agent's proposal); settings-sync D7 updated. Folded into
  README; the open list is now empty.
- Owner: fixed screen keys are definitions with `configurable: false` and run through the registry (D11). The code
  shape (defineAppCommand / useCommand / CommandButton, translation key in the definition) recorded as D12, the
  agent's proposal unopposed. Folded into README. Next: rightsize before proposing to close.
- Rightsize (three passes). Fixed in the record without asking: D12's reason for a translation key was a change of
  language, but githq is English only; the real reason is that module-level definitions cannot call `t()`.
- Owner on the rightsize items: flat places plus a hand-kept list of places on screen together, replacing nested
  places, which misreported the list-and-item `O` clash as an override (D13, D6 retired); numbered families as one
  definition each with a number, the binding naming what the number picks (D9 amended); D8's rule enforced by a test;
  plain string id with a uniqueness test (D2 amended). CommandButton vs a key helper: owner did not follow; to explain.
- Owner: a `priority` on the definition orders the command menu (D14; number default 0 is the agent's proposal).
- Owner reported a bug: with nothing checked, "Open full screen" in a list's menu opens an unrelated PR. It is
  `list.fullScreen` (`packages/app/lists/ListView.vue:960`), acting on the list's selected row, which is kept by key
  even when not visible; its title does not name the row. Not part of this design; offered as a separate fix.
- Owner: a key helper for buttons, not `<CommandButton>` (D12 amended, old form in history). First build step written
  into README. Owner agreed to close the design and to a separate issue for the "Open full screen" bug.

## 2026-11-16 (delivery, M1)

- Built: the ordered pairs of places on screen together decide at runtime which command runs a shared key (the list's
  `O` before the opened item's). Review flagged it against D13's "places serve only these checks"; owner chose to keep
  it over section order (D13 rewritten, prior form in history).

## 2026-11-17 (delivery, M2)

- Owner: a place may name a command for what it acts on or which way it toggles; the definition keeps the general name
  (D12 amended). Per command: ⌫ "Remove" in the settings lists is fixed; leaving full screen is "Close full screen" on
  Escape, ⇧Enter only opens it; the list's layout toggle loses its key (⇧V), too niche.
- Owner: a project keeps its own `C` for a new issue in it (H5); D7 takes only the app-wide one.
- Owner: two fixed keys never conflict (D13 amended); the Escape exception and the board's own place go.

## 2026-11-17 (delivery, M4)

- Owner: the review's reply in a thread is the same command as the item's comment (R), named "Reply to the thread"
  there.

## 2026-11-17 (delivery, M5)

- Owner: the merge panel's keys stay the dialog's (D11); its methods 1–3 become a numbered family it handles.
- Owner, key clashes: select the failed items ⌥F (D8); ⇧Enter opens a commit full screen as everywhere, its pull
  request on ⇧O; Try again is one fixed Enter command everywhere; restart to update ⌥R everywhere.
