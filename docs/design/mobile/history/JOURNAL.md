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
- 2026-11-06 — Owner: on a phone, what githq does not support there hands off to github.com like any other address
  githq does not show (D3). Scope proposed as D4 — owner did not object, not confirmed; merging still open. Still
  unanswered: why the owner wants githq on a phone (what they do with it there).
- 2026-11-06 — Owner accepted: the window's width decides the mobile layout and hand-offs; resizing never navigates
  (D5). Proposed, not confirmed: the desktop app's window never gets that narrow (D6).
- 2026-11-06 — Owner accepted: the first sign-in (tracking choice, first download) works on a phone; tracking
  settings later do not (D7).
- 2026-11-06 — Owner: merging later (D4 Rejected). Why mobile at all: "I simply want access to all my things on
  GitHub from the phone, as comfortable as" from the computer; a hybrid (not native) phone app will come later (D8).
  README written from D1–D8 and `variants.md`.
- 2026-11-06 — Owner: leave the board for now (D9). Owner asked for a prompt for the design agent focused on
  navigation: brief written as `ui/navigate-on-a-phone.md`, the prompt given inline (AGENTS.md → Design). Open:
  githq's own Settings (`/settings`) is not on GitHub, so the hand-off of D3 would send it to GitHub's settings —
  raised with the owner.
- 2026-11-06 — Variants drawn in `githq.pen`, frame `App · Mobile`, codes MB. Owner's idea on seeing them: the command
  menu button leaves once you are inside a task (writing a reply, a drill-down), drawn as MB70–MB77 and still to be
  picked. Owner picked: MB23 (D10), MB49 (D11), MB51–MB53 (D12), MB57 (D13, against the recommended slash). No reasons
  given for the picks. MB23 leaves the button's Variant D (MB8–MB9), a bar that stays on the item, without its
  premise; raised with the owner.
- 2026-11-06 — Owner: the top-right corner gets both drawn options, two icons fit: filters and New issue on lists
  (D14). The dock above Safari's bar is accepted: no control over the browser's interface (D15). Applied to the top
  bar of every list screen in `App · Mobile` except the address-bar variant (MB4) and the root list of MB18.
