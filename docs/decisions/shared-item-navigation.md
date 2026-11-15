# Shared item navigation for issues, pull requests and workflows

## Status

Accepted

## Context

A GitHub Actions workflow opens as an item, like an issue or a pull request (actions D15): in the panel beside the
Workflows section or full screen, with the same keys, Back and arrangement switch (`docs/design/githq/navigation.md`).
The panel and the page existed only for issues and pull requests: the opened item's address is `{owner, name,
number}` with `pane=issue` (`packages/app/item/itemRoutes.ts`), the arrangement logic lives in `OpenedItem.vue` beside
issue-only concerns (unsaved-edit guard, merge move-on, looked tracking), and the header and keys in `ItemView.vue`
(1331 lines) beside the issue body (sticky summary teleported between columns, stack map, thread).

> **Checked 2026-11-14:** the behaviour is covered by e2e — `e2e/src/item/itemArrangement.spec.ts` (6 tests),
> `item/itemUrls.spec.ts`, `edits/commentEdits.spec.ts` (edit guard), `item/itemThread.spec.ts` (looked),
> `myWork/myWorkStacks.spec.ts` (stepping through the stack map) — plus 63 tests in `ItemView.spec.ts`.

## Options Considered

- **One frame for every kind:** extract routing with a kind, the arrangement controller, the header and a
  two-column/tabs body; issues, pull requests and workflows plug in. Trade-off: about 600 lines moved out of the most
  delicate code, including the summary teleport and column layout, inside a feature.
- **A separate workflow item:** its own routes, controller and header in `workflows/`, under ten lines changed in
  `item/`. Trade-off: about 200 duplicated lines that can drift; a contract e2e to hold them together.
- **Shared navigation only:** a kind in the opened-item address, a `useItemArrangement` composable (arrange, expand,
  back to panel, close, step, move to the page, the item's keys) with an optional unsaved-edit guard, and a
  presentational `ItemHeader`. The issue body stays as it is.

## Decision

Shared navigation only (the owner, 2026-11-14). What must behave identically — moving between levels and the keys —
is one piece of code, and the risky part of a full frame (the issue body's layout) is left alone. The existing item e2e
guard the extraction.

## Consequences

A third kind of item gets navigation and header for free and builds its own body. The issue body is not shared: a
later kind that wants the same two-column layout extracts it then. The opened-item history mark changed format (no
compatibility with marks older builds wrote; the project is greenfield).
