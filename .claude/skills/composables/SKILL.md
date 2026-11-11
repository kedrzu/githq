---
name: composables
description: >-
    Vue composables in githq — use[Feature] functions, reactive returns, useDataSource, useService,
    event listeners and reactivity pitfalls. Use before writing or changing a composable or
    component-scoped reactive logic in packages/app.
---

# Composables

## Paths

- Beside the feature that uses it (`packages/app/<feature>/use*.ts`); shared ones in `packages/app/components/`
  or `services/` (`useNow.ts`).

## Decisions

- State shared across screens is a store service (`ioc` skill), not a composable: screens read the local store
  and never wait on the network (`ARCHITECTURE.md`, "App and UI").

Links in the document below are relative to `nzyme/docs/practice/`; package READMEs are `nzyme/packages/<pkg>/README.md`.

!`cat nzyme/docs/practice/composables.md`
