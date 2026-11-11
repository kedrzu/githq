---
name: code-conventions
description: >-
    How TypeScript and Vue code is written in githq — file organization and naming, function order,
    imports, casts, JSDoc, Vue SFC order and BEM classes. Use before writing, refactoring or reviewing
    any .ts or .vue file.
---

# Code conventions

## Paths

- App code by feature: `packages/app/<feature>/`, imported through the `@/` alias; nothing is auto-imported
  (`ARCHITECTURE.md`, "App and UI").
- Generated files, never edited by hand: `*.loc.ts`, `packages/github/src/generated.gen.ts`, the tsconfigs.

## Commands

- `bun run lint:check`, `bun run format` (Markdown too); the code map: `bun run index` (`INDEX.md`, `UTILS.md`).

Links in the document below are relative to `nzyme/docs/practice/`; package READMEs are `nzyme/packages/<pkg>/README.md`.

!`cat nzyme/docs/practice/code-conventions.md`
