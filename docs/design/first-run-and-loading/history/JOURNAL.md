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
- 2026-11-06 — Rightsize (3 passes): D4's segment and D5's list stand (owner picked them over the simpler versions);
  recorded as build notes that D2 changes FirstSignInFrame rather than adding a frame and D3 reuses an existing
  freshness shape. Put to owner: D4's click-through list, and the opened item's panel in D5.
- 2026-11-06 — Owner: no per-repository download marker anywhere in the sidebar; download progress only in the status
  bar's left segment (D4 sharpened). Asked: does a repository's own segment still say its closed items are downloading
  (D3), and does the left segment keep its click-through list; the opened item in D5 still unanswered.
- 2026-11-06 — Owner clarified: repositories' download state lives only in the status bar's left segment; each screen's
  own segment and its empty-while-loading state stay (D3, D5 hold). Taken as the owner's reading: no list behind the
  left segment (D4); the opened item dropped from D5. Scope grows: every empty state, not only loading ones — some are
  "wooden". Dispatched an inventory of the app's empty states.
- 2026-11-06 — Inventory of empty states written to empty-states.md. Proposed D6 (four reasons; never "nothing" while
  arriving or unreadable); asked the owner to confirm, and where the line of scope falls (screens and lists in,
  panel/picker lines out).
- 2026-11-06 — Owner confirmed the four reasons (D6) and the scope line (D7). Added the order between reasons and the
  per-screen table (empty-states.md). Folded into README.
- 2026-11-06 — Rightsize on D6/D7 (3 passes). Taken as build notes in D6: "can't be read" is one pattern with a cause
  line, shown only when the screen has nothing; an empty group among rows keeps "Nothing here.". Put to owner: splitting
  "can't be read" into permanent and transient; fixing only the wrong states instead of the whole table.
- 2026-11-06 — Owner: one "can't be read" reason (not split), the whole table (not only the wrong states); both
  recorded as D6 Rejected lines. Added what gets built first to README. Proposed closing.
- 2026-11-06 — Owner asked for the design agent's prompt: wrote ui/first-run-and-empty-states.md (brief) and
  ui/design-agent-prompt.md.
- 2026-11-06 — Prompt sent to the design agent; removed ui/design-agent-prompt.md from the repo (owner).
- 2026-11-06 — Design agent drew the screens in githq.pen (G15–G17, ES1–ES25), proposed D8–D16, retired G6 and G7.
- 2026-11-06 — Owner picked ES1 (Variant A) without its status line, asking for more, wider and less faded ghosts and a visible motion; picked ES5. ES2, ES3, ES6, ES7 deleted; D8, D9, D11 rewritten.
