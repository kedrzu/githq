# Journal — mobile web app

Append-only. One line per decision, rejection or answer from the owner.

- 2026-11-06 — Owner's opening request (translated): design a mobile version of the web app. The desktop's menus
  sit side by side, so mobile needs nested navigation. A bottom bar for moving between the important parts of, for
  example, a repository: issues, pull requests, commits. The first mobile version need not do everything — commits
  and code review can wait; the basic functionality matters. The command menu must be easy to open, and with no
  keyboard that means a button of its own.
- 2026-11-06 — Codebase survey: no responsive handling in the app today (no width media queries, no viewport meta);
  the landing page alone has a mobile layout, via container queries (`styles/tokens.scss:241`). The item already
  has a full-page arrangement (`item/itemRoutes.ts:12`); the sidebar search button is the only clickable trigger of
  the command menu (`shell/Sidebar.vue:205`). Nothing folded into a README yet.
- 2026-11-06 — Owner: undecided on the bottom bar; wants to see variants drawn before choosing. Every navigation
  idea from here goes into `variants.md` as something for the design agent to draw. Direction set: classic mobile
  navigation, making good use of the top-left and top-right corners. Owner's ideas recorded there: a nested
  hamburger menu on the left (sidebar level, then a repository's sections); or a wide left menu for places and a
  contextual right one for the current screen; the bottom bar perhaps on list screens only, not where an input
  takes the bottom (the comment box). Not yet answered: what the owner does with githq on a phone.
- 2026-11-06 — Owner: no menu opens by swiping from an edge, risky on the iPhone (D2). Command menu button: the
  top-right corner is natural, but leave the design agent room to find something smarter; variants are starting
  points, not the boundary (D1). Recorded the two couplings (command menu is already contextual; a button on a
  list-only bar vanishes from the item screen) in `variants.md`.
