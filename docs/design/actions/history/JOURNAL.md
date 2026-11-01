# Journal

Append-only.

- 2026-11-01 — Brief from owner: track GitHub Actions and workflows; they often miss that an action fails in some repo; want an easy overview, and details more convenient than on GitHub. Separate folder from `docs/design/githq/` (which is still in the old shape and is not touched here).
- 2026-11-01 — Checked live and in docs: no cross-repo run list, free 304 on `actions/runs`, `Workflow.runs` in GraphQL via node id, `repo` scope suffices, logs readable from a browser, annotations do not locate the failure. Recorded in DECISIONS as D1–D3, all agent proposals, none confirmed. Asked owner: where the signal appears, which failures count, repo coverage, what is inconvenient on GitHub. README written from the owner's brief; "failure screen with no page loads" and "one keystroke" are the agent's reading, not yet confirmed.
