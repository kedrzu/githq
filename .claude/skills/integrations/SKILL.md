---
name: integrations
description: >-
    The GitHub client in packages/github: GraphQL operations, the committed schema, the generated SDK
    and codegen. Use when adding or changing a GitHub query, mutation or REST call in githq.
---

# Integrations

## Paths

- Operations: `packages/github/src/operations/*.gql`. Schema: `packages/github/src/schema.graphql`.
- Generated SDK, never edited: `packages/github/src/generated.gen.ts`.

## Commands

- `bun run codegen` regenerates the SDK. `bun --cwd packages/github schema` refreshes GitHub's schema.

## Decisions

- GraphQL when it can do the job, REST where it can't, conditional requests for change detection: `AGENTS.md`, "Product principles".

Links in the document below are relative to `nzyme/docs/practice/`; package READMEs are `nzyme/packages/<pkg>/README.md`.

!`cat nzyme/docs/practice/api-clients.md`
