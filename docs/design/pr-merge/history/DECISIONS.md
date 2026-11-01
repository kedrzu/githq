# Retired decisions

Full text under the original IDs; never edited after being written.

## D8

Retired 2026-11-01, replaced by [D9](../DECISIONS.md#d9).

**Several selected pull requests can be merged together: one confirmation, each with its own default method and
message; one failing does not stop the others, and the user sees which failed.** (2026-11-01, owner, on the design
agent's proposal)

**Why.** The case is a run of small pull requests such as five from Dependabot. Closing several at once already
exists (`packages/app/lists/ItemContextMenu.vue:241`).
