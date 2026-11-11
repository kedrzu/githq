---
name: logging
description: >-
    Logging in githq with @nzyme/logging — injecting Logger, levels, a constant message with scalar
    fields, caught errors. Use before adding a log line or logging a caught error in the app.
---

# Logging

## Paths

- `Logger` is injected in services and stores (`packages/app/store/ItemStore.ts`, `sync/`, `edits/EditQueue.ts`);
  in a component through `useLogger`.

Links in the document below are relative to `nzyme/docs/practice/`; package READMEs are `nzyme/packages/<pkg>/README.md`.

!`cat nzyme/docs/practice/logging.md`
