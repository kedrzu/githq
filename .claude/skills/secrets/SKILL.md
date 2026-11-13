---
name: secrets
description: >-
    githq's OAuth client secrets in Bitwarden Secrets Manager, read through @nzyme/secrets: the
    provider, the `bun nzyme secrets` commands, what runs with them and what happens on a machine without
    store access. Use when a task needs a credential, when `bun run dev` warns about the secret store, when
    sign-in in development answers `not_configured`, when adding or changing a secret, and before running
    anything that could print the environment or read the keychain.
---

# Secrets

API: `nzyme/packages/secrets/README.md`; the store's setup:
`nzyme/packages/bitwarden/README.md`. Why this store: `ARCHITECTURE.md#decisions`.

## Paths

- Provider and commands, with the project id and every mapped name: `scripts/secrets.ts`, a plugin of the `nzyme`
  binary listed under `nzyme.plugins` in `package.json`.
- The fallback wrapper: `scripts/withSecrets.sh`.

## Store

One Bitwarden Secrets Manager project shared with the owner's other repos, with one environment: development. A
key is the variable's name with the prefix `GITHQ_` and the environment as a suffix (`GITHQ_GITHUB_CLIENT_SECRET_DEV`, `_PROD`). `GITHQ_ENV` selects it: `dev` by default, `GITHQ_ENV=prod bun nzyme secrets …` for production. The token is kept under
the keychain suffix `githq`, so logging in from another repo does not replace it. Each machine has its own machine account;
the owner's machines can write. Production's Worker reads its own Worker secret, which `bun --cwd packages/worker secrets:put:prod` sets from
the store; e2e uses the dummy `packages/e2e/worker.vars`; CI reads nothing from the store. Client IDs are public and
not secrets: `packages/github/src/oauthClientIds.json`.

The updater's signing key and its password, and the Apple certificate and notarization credentials (`APPLE_*`), are mapped with `GITHQ_ENV=prod` only, so no development command holds them. `bun run build:desktop:signed` reads them from the store; the Release action signs with repository secrets set from it (`docs/desktop/RELEASING.md`).

The usage statistics token, `CLOUDFLARE_ANALYTICS_TOKEN`, has an environment of its own, `GITHQ_ENV=stats`, with that one entry (key `GITHQ_CLOUDFLARE_ANALYTICS_TOKEN_PROD`). `secrets run` refuses to start when a mapped secret is missing, so keeping it out of `dev` and `prod` leaves `bun run dev`, `build:desktop:signed` and `secrets:put:prod` working before it is stored, and out of release builds' environment. The owner creates a Cloudflare API token (Account → Account Analytics → Read) and stores it once, through the masked dialog: `GITHQ_ENV=stats bun nzyme secrets set CLOUDFLARE_ANALYTICS_TOKEN --prompt="Cloudflare API token with Account Analytics: Read"`. Then `bun --cwd packages/worker stats` prints the last 30 days of usage counts.

## Commands

- `bun nzyme secrets login` — once per machine, by the person holding the token.
- `bun nzyme secrets list` — status of each name, never a value.
- `bun nzyme secrets set <NAME> --prompt="<what it is, where to find it>"` — asks the owner through a masked dialog.
- `bun nzyme secrets run -- <command>`, `bun nzyme secrets refresh`.

## What runs with them

`scripts/withSecrets.sh` wraps the Worker's `dev` and `preview`; the desktop app needs no secret. It uses `secrets run`, or warns and runs the command without the store when the store cannot be read, so a
machine with no access still works: the token form signs in on the web, and the Worker's auth endpoints answer
500 `not_configured`.

`wrangler dev` binds only the names under `secrets.required` in `packages/worker/wrangler.jsonc`, so a new secret
the Worker reads goes there too, which also makes `wrangler deploy` require it in production.

## While `.env` exists

Until #118 removes it, a non-empty root `.env` wins: Bun and Nx load it into the environment, and `secrets list`
reports those names `overridden by environment`. To use the store in a checkout, or to test it, move `.env` aside.

Links in the document below are relative to `nzyme/docs/practice/`; package READMEs are `nzyme/packages/<pkg>/README.md`.

!`cat nzyme/docs/practice/secrets.md`
