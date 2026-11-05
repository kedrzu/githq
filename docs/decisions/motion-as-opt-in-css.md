# Motion as opt-in CSS, not as Transition components

## Status

Accepted (2026-11-05).

## Context

githq gets short animations — an overlay fading and sliding in by a few pixels in 150 ms — and a switch to turn them
off (Settings → Display). They must never cost speed or keys: Escape, typing right after ⌘K and focus returning to
where it was have to work the instant the user does them. A user who asked their system for reduced motion gets none,
whatever the switch says. Stories, component tests and the landing page must not need to know about the switch.

Every overlay of the app (menu, context menu, popover, dialog, tooltip, toast) is reka-ui's. Facts the decision rests on
(checked 2026-11-05 in the installed packages):

- reka-ui's `Presence` follows the element's CSS `animation`, not a Vue `<Transition>`. On `animation-name: none` it
  unmounts at once (`usePresence.js`), and while a closing animation runs it keeps the element mounted.
- While an overlay stays mounted, its `FocusScope` returns focus only on unmount, and a `Tooltip`'s `DismissableLayer`
  stays on the layer stack until unmount. So an Escape pressed during a closing fade reaches nothing (reproduced), and
  focus is not back where it was.
- Every toast caller unmounts its toast when it closes.
- `Reveal` (`@nzyme/vue`) animates through `--reveal-duration`, falling back to 0.2 s.
- `ListView` finds its rows with `querySelector`, so rows leaving with an animation would still be found.

## Options Considered

### Own `Transition` components reading the setting from a provider

The first proposal: wrappers (`FadeTransition`, …) around each overlay's content that read "animations on" from a
provider and render a `<Transition>` or nothing.

- Pros: the Vue way, the setting is plain data.
- Cons: `Presence` does not look at Vue transitions, so a wrapper changes nothing about when reka unmounts the overlay;
  it would need `force-mount` and its own bookkeeping to be heard at all. Every call site would need the wrapper or a
  condition on the setting, and a new overlay without it would silently not animate or not obey the switch.

### Opt-in CSS: `data-motion` on `<html>`, `@mixin motion`, global keyframes

The shell sets `data-motion="on"` on `<html>` while the setting is on. `@mixin motion` (`styles/tokens.scss`) wraps a rule in
`@media (prefers-reduced-motion: no-preference)` and that attribute; `@mixin motion-popper` does it for menus and
popovers, by the side reka placed them on. The keyframes `motion-fade-in` and `motion-slide-in` are global
(`styles/main.scss`), because in a CSS module a `@keyframes` name is hashed per file.

- Pros: reka's `Presence` reads the computed `animation-name` itself, so with the switch off or reduced motion asked
  for it is `none` and the overlay unmounts at once, with no call site holding a condition. A component without the
  mixin simply has no motion, so stories, the landing page and screens outside the shell are unchanged.
- Cons: the switch's effect is spread over a mixin, two keyframes and an attribute instead of one visible component.

## Decision

Opt-in CSS. The motion lives in styles, under `html[data-motion='on']` and `prefers-reduced-motion: no-preference`.

- Only opening animates. Everything closes at once. Focus and the layer stay with an overlay until it unmounts, so a
  closing animation would lose an Escape and delay focus's return; a toast and the rest unmount on close anyway.
- A `Reveal` is driven through `--reveal-duration` on `html` (0 off, 100 ms on, which `Reveal` stretches to 150 ms
  in total), so nzyme did not change.
- List groups stay instant, because `ListView` finds rows with `querySelector`.
- The shell sets the attribute with a `watchEffect` (`layouts/shell.vue`), not with `useHead`: `nuxt/app` does not
  resolve in the component tests that mount the layout, and the shell is never prerendered.
- The merge panel now hangs from near the window's top instead of being centred, so that growth under it moves nothing
  above it (PM8). The old test passed only because it measured in the first frames of the opening transition.

## Consequences

- The e2e suite runs with motion on, as users have it (`src/shell/motion.spec.ts` proves the animation, the instant
  close, the switch and reduced motion). A spec that turned timing-dependent because of an animation is a bug to bring
  back, not a wait to add.
- A new overlay gets motion by including `@mixin motion` (or `motion-popper`) in its style, and needs nothing else.
- Closing animations are out for good unless reka-ui's focus return and dismissal change; they would have to be
  re-checked first.
- A layer that is not reka's would not be unmounted by `Presence` and has to take care of its own closing.
