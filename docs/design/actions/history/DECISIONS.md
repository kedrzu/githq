# Retired decisions

Full text under the original IDs, oldest first. Never edited after being written.

## D1

Retired 2026-11-01, replaced by the current [D1](../DECISIONS.md#d1), which adds which refs count.

**A workflow is broken when its latest finished run failed; the overview lists workflows, not runs or
commits.** (2026-11-01, proposal of the design agent, not confirmed by the owner)

**Why.** A run is one observation of a workflow. A failed nightly or deploy stays broken after later runs of
other workflows and after new green commits.

**Rejected.**
- A feed of recent failed runs: a failure scrolls away while still broken, and a failure already fixed by a
  later run stays listed.
- The check rollup of the default branch's latest commit: a new green commit hides a broken nightly or deploy.
