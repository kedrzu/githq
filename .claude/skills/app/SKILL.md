---
name: app
description: >-
    The Nuxt app in packages/app: where screens, routes, stories, specs and build targets live in
    githq. Use when creating, changing or reviewing a screen, a route, a Vue component or a Nuxt setting.
---

# App

Read `nzyme/plugins/nzyme/skills/ui/SKILL.md` before building a component; it holds the practice.

## Paths

- Screens and their components: `packages/app/<feature>/`; shared ones in `packages/app/components/`.
- Routes: `packages/app/app/router.options.ts`, nowhere else.
- Container: `packages/app/plugins/iocPlugin.ts`; the Storybook preview (`.storybook/preview.ts`) registers the same interfaces.
- Tokens and global CSS: `packages/app/styles/`, compiled through `viteShared.ts`.
- Stories and specs: beside the component. Screen harnesses: `packages/e2e/src/harnesses/`.

## Requirements

- A story fails its test on a WCAG violation (`a11y.test: 'error'`, `bun run test:stories`).
- A build target is checked after it builds: `packages/app/scripts/check*Build.ts`.
- Panels beside each other — a column left or right of a pane, a sidebar, a side panel — are resized through Reka's
  splitter: `components/ColumnSplit.vue` (`side`, `paneMin`), or where it doesn't fit `SplitterGroup` +
  `components/ResizeHandle.vue` + `components/usePanelWidth.ts`, as `AppShell` and `ItemView` do. Never a handle
  of the panel's own: `components/WidthHandle.vue` is only for a dialog centred in the window, widened on both sides.

## Decisions

- Targets, the landing page and the UI package: `ARCHITECTURE.md`, "App and UI" and "Decisions".
