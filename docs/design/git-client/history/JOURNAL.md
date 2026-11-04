# Journal

Append-only; one line per turn that settled something.

- 2026-11-01 — Owner: wants a commit graph view (branches, tags, no code yet), Fork/GitKraken-like; long-term a
  full local git client in the desktop app, tightly integrated with GitHub; asks whether the browser should
  hold a checkout in a virtual file system so web and desktop feel the same. Checked: github.com git endpoints
  have no CORS; GraphQL has refs, history and parents. Proposed D1 (graph from the API on the web, local clone
  overlay on desktop, no browser clone) — not confirmed. Folded into README: opening (why still missing) and
  the data-source section.
- 2026-11-01 — Owner: the goal is one fast app for git, GitHub, review and tasks, maybe with a built-in agent
  orchestrator (Conductor/Paseo-like); graph per repository, not across repositories (D3); system git on the
  desktop "rather yes" (D2). Proposed D4 (orchestrator out of scope). README: why and scope written.
  Next open: how a GitHub repository, its local clones and their worktrees relate.
- 2026-11-01 — Owner: adding folders and scanning both fine eventually (D5, add folder first); worktrees as graph
  markers plus in the branch list, with per-worktree actions such as reveal in Finder (D6); forks as simple as
  possible (D5: match by origin only). Unanswered: can one repository have two separate clones. README:
  clones and worktrees section written.
- 2026-11-01 — Owner: one clone per repository, worktrees for parallel work, deliberately opinionated (D7).
  Proposed: adding a worktree folder adds its clone; adding a second clone offers replacement. Folded into
  README. Next: the first version (graph from GitHub's API) — row content, navigation, loading history.
- 2026-11-01 — Owner: rows carry pull request and CI state; check the cost. Measured on nuxt/nuxt: points
  negligible, latency 1 s vs 2-4 s per page. Proposed D8 (immutable pages cached for good, PR/CI for visible
  rows separately). Folded into README.
- 2026-11-01 — Owner: caching and paging next; commits as a tab of the repository view, which must be
  generalised (All/Issues/Pull requests today), UI decided by designing several directions. Measured refs,
  batched branch history and the matching-refs ETag. Proposed D9 (paging and cache); recorded D10.
  Folded into README. Open: does the graph need the repository tracked.
- 2026-11-01 — Owner: ok to the Commits tab working without tracking (D11). Folded into README.
- 2026-11-02 — Owner agreed: branch list scrolls to the tip (D12), commit details without files or diff (D13);
  graph line layout left to implementation; asked to close. README: branch list, commit details, first
  version and what follows. Next: rightsize before closing.
- 2026-11-02 — rightsize (three passes). Owner chose the simpler version of all four items put to the owner: no
  date gate on drawing (D9), refs checked by one GraphQL request instead of REST ETags (D9), an unloaded ref
  opens its commit's details (D12), a second clone is refused (D7). Prior forms in history/DECISIONS.md.
  Design closed by the owner.
- 2026-11-02 — Owner merged the design (#67) and asked for the design agent's prompt: ui/browse-commit-history.md and ui/design-agent-prompt.md. Open in the brief: a Worktrees section in the list.
- 2026-11-02 — Design agent drew the commit history in `githq.pen`: "App · Commits" (CH1–CH41) and "Desktop ·
  Commits" (CD1–CD7). Three directions for the repository view's shape, Variant A recommended (D14); proposals
  D15–D21. Open with the owner: the direction, the variants, and the data questions in the brief's "The screens".
- 2026-11-02 — Owner kept both the tabs and the column layouts behind a synced setting in Settings · Display, to try
  both; Work and Code dropped. D14 rewritten as the owner's decision, D22 added; CH7–CH9 and CH21 deleted, CH42 and
  CH43 drawn.
- 2026-11-02 — Owner on the graph: a draggable divider instead of a fixed cap (D17); pull request and CI right after the
  headline, author with name, a faint stripe, failure as red dot and ✕ only (D18). CH13, CH14 deleted; CH44, CH45 drawn.
- 2026-11-02 — Owner picked CH18: a commit's details open in a panel in the list's place (D16); CH19 deleted.
- 2026-11-02 — Owner picked CD2: worktrees on their branches, no Worktrees section (D21); CD1 deleted. No variants left open.
- 2026-11-03 — Building the first version: owner settled a cursor not yet moved (D19 sharpened) and freshness in the status
  bar only (D23); the Commits screens redrawn.
- 2026-11-03 — Owner on the branch list: `↵` goes back to the graph (D12, CH15 redrawn), `↑`/`↓` through matches (D15, CH30),
  not on `FilterList`, all drawn tips ask for their state; the narrowest graph is two lanes (D17).
- 2026-11-03 — Building the details: the body is read on opening (D13), no count of failing checks; CH16, CH18, CH20, CH27, CH40, CH41 follow.
- 2026-11-03 — Owner: branches and tags always on the left, also in the tabs layout; the repository's column resizable and
  one width with that list (D15, CH46); in the tabs layout the details on the right with the list staying (D16).
- 2026-11-03 — Owner on the details: they follow the selection from the section's opening, starting on the default branch's
  newest commit; `Esc` until the next move; on a narrow window under the graph (CH48), on a wide one resizable under their
  own name (D16). The row's pull request number is a link (D18). The graph's pane draws no focus ring: the cursor row shows
  where the keys go.
