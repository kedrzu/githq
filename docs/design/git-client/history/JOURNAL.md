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
