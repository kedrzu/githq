---
name: ioc
description: >-
    Dependency injection with @nzyme/ioc in githq — services, commands, factories, the app's container
    and stores shared across components. Use before writing or changing a defineService, defineCommand
    or defineFactory, or wiring the container.
---

# IoC

## Paths

- The one container: `packages/app/plugins/iocPlugin.ts`; other Nuxt plugins state `dependsOn: ['ioc-plugin']`.
- The Storybook preview (`packages/app/.storybook/preview.ts`) registers the same interfaces.
- App-wide services: `packages/app/services/`; stores beside their feature (`store/`, `repos/`, `projects/` …).

## Decisions

- The local store is in memory, backed by IndexedDB through the `*Persistence` interfaces the container sets
  (`ARCHITECTURE.md`, "App and UI").

Links in the document below are relative to `nzyme/docs/practice/`; package READMEs are `nzyme/packages/<pkg>/README.md`.

!`cat nzyme/docs/practice/ioc.md`
