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
