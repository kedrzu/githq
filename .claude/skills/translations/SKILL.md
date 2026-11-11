---
name: translations
description: >-
    User-facing text in githq — .loc.yaml files beside each component, compiled to typed .loc.ts. Use
    before adding or changing any text a user sees in packages/app; UI strings are never hardcoded.
---

# Translations

## Paths

- `<Name>.loc.yaml` beside the component or module that shows it; the generated `<Name>.loc.ts` is never
  edited.
- The language: `packages/app/i18n/AppLanguageContext.ts`.

## Decisions

- githq speaks English only (`en`); every key has just an `en` value.

## Commands

- `bun run codegen` (or `bun run localise`) compiles them; `bun run dev` watches.

Links in the document below are relative to `nzyme/docs/practice/`; package READMEs are `nzyme/packages/<pkg>/README.md`.

!`cat nzyme/docs/practice/translations.md`
