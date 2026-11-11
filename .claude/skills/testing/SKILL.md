---
name: testing
description: >-
    Writing tests in githq — whether a test is worth it, bun tests, Storybook component tests and specs,
    Playwright e2e against the mocked GitHub. Use before writing, reviewing or debugging a *.test.ts,
    *.spec.ts or e2e spec.
---

# Testing

## Paths

- `*.test.ts`: `bun test`, beside the code. Test helpers and sample data: `packages/app/testing/`.
- `*.spec.ts` under `packages/app`: Vitest browser specs over Storybook stories, beside the component.
- E2E: `packages/e2e/src/<area>/*.spec.ts`; screen harnesses `packages/e2e/src/harnesses/`; the GitHub mock
  `packages/e2e/src/github/GitHubMock.ts`, which fails a test on any operation it did not register.

## Requirements

- Tests never call the real GitHub.
- A story fails its test on an axe violation (WCAG 2.2 AA, `packages/app/testing/accessibilityTags.ts`);
  whole-page rules are checked in `packages/e2e/src/accessibility/` (`ARCHITECTURE.md`, "Decisions").
- E2E tests pass twice in a row and with `--workers=4`.

## Commands

- Running each kind, scoped and in full: the `verify` skill.

Links in the document below are relative to `nzyme/docs/practice/`; package READMEs are `nzyme/packages/<pkg>/README.md`.

!`cat nzyme/docs/practice/testing.md`
