# Journal

Append-only; one line per turn that settled something.

- 2026-11-06 — Owner asked to drop the first-download page, align the sign-in screens' top bar with the app's on the
  desktop app, and show loading inline (empty state while nothing has arrived; status bar while data is incomplete;
  maybe a row at the end of lists). Explored the code: repository freshness goes `fresh` once open items arrive
  (the "dead" status bar); window buttons are fixed, the bar around them differs (36px vs 56px).
- 2026-11-06 — Owner: no download step (D1); choosing screen stays its own screen with the app's 36px strip, no step
  indicator (D2); loading shown only when a screen lacks data it will have, not for refreshes, even ones that found
  changes (D3); end-of-list row postponed. Folded into README.
- 2026-11-06 — Owner: overall progress goes to the status bar's sidebar segment in place of the allowance while anything
  downloads, clickable for the per-repository list (D4); the list of screens that can be incomplete accepted (D5).
  Folded into README.
