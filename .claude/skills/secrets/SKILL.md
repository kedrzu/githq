---
name: secrets
description: >-
    githq's OAuth client secrets in Bitwarden Secrets Manager, read through @nzyme/secrets: the
    provider, the `bun secrets` commands, what runs with them and what happens on a machine without
    store access. Use when a task needs a credential, when `bun run dev` warns about the secret store, when
    sign-in in development answers `not_configured`, when adding or changing a secret, and before running
    anything that could print the environment or read the keychain.
---

# Secrets

API: `nzyme/packages/secrets/README.md`; the store's setup:
`nzyme/packages/bitwarden/README.md`. Why this store: `ARCHITECTURE.md#decisions`.

## Paths

- Every secret, declared with `defineSecret`, a description each and the environments it is enabled in:
  `packages/secrets/src/secrets.ts`. Nothing else lives in that module: the Worker bundles it.
- The store, with the project id and the prefix: `packages/secrets/src/GithqSecretStore.ts`; `GITHQ_ENV` in
  `packages/secrets/src/githqEnv.ts`.
- The loader a Bun script calls: `packages/secrets/src/loadGithqConfig.ts`.
- The commands: the `githq` CLI, `packages/cli/src/cli.ts` (`bun githq …`), its provider `packages/cli/src/GithqSecrets.ts`.
- The fallback wrapper: `scripts/withSecrets.sh`.

## Store

One Bitwarden Secrets Manager project shared with the owner's other repos, with one environment: development. A
key is the variable's name with a prefix naming the repo and the environment (`GITHQ_DEV_GITHUB_CLIENT_SECRET`, `GITHQ_PROD_…`, `GITHQ_STATS_…`); the commands show and take the name without it. `GITHQ_ENV` selects the prefix: `dev` by default, `GITHQ_ENV=prod bun secrets …` for production. The token is kept under
the keychain suffix `githq`, so logging in from another repo does not replace it. Each machine has its own machine account;
the owner's machines can write. Production's Worker reads its own Worker secret, which `bun --cwd packages/worker secrets:put:prod` sets from
the store; e2e uses the dummy `packages/e2e/worker.vars`; CI reads nothing from the store. Client IDs are public and
not secrets: `packages/github/src/oauthClientIds.json`.

The updater's signing key and its password, and the Apple certificate and notarization credentials (`APPLE_*`), are enabled with `GITHQ_ENV=prod` only, so no development command holds them. `bun run build:desktop:signed` reads them from the store; the Release action signs with repository secrets set from it (`docs/desktop/RELEASING.md`).

The usage statistics token, `CLOUDFLARE_ANALYTICS_TOKEN`, has an environment of its own, `GITHQ_ENV=stats`, with that one secret (key `GITHQ_STATS_CLOUDFLARE_ANALYTICS_TOKEN`). `secrets run` refuses to start when an enabled secret is missing, so keeping it out of `dev` and `prod` leaves `bun run dev`, `build:desktop:signed` and `secrets:put:prod` working before it is stored, and out of release builds' environment. The owner creates a Cloudflare API token (Account → Account Analytics → Read) and stores it once, through the masked dialog: `GITHQ_ENV=stats bun secrets set CLOUDFLARE_ANALYTICS_TOKEN --prompt="Cloudflare API token with Account Analytics: Read"`. Then `bun --cwd packages/worker stats` prints the last 30 days of usage counts; it reads the token from the store itself.

## Commands

- `bun secrets login` — once per machine, by the person holding the token.
- `bun secrets list` — each enabled secret with its store or `missing`, then stored keys `not declared` or `not
  enabled here`; never a value. It exits 0 even when one is missing.
- `bun secrets set <NAME> --prompt="<what it is, where to find it>"` — asks the owner through a masked dialog;
  refuses a name not declared or not enabled in this `GITHQ_ENV`. A new secret is declared in `secrets.ts` first.
- `bun secrets run -- <command>` (every enabled secret; it starts nothing when one is missing),
  `bun secrets refresh`.

## What runs with them

Code resolves a secret through the container, never from `process.env` or `env`: `container.resolve(SECRET)` with
the declaration from `@githq/secrets/secrets.js`.

- A Bun script creates a container and calls `await loadGithqConfig(container)` (an environment variable wins over the
  store; with `CI` set the store is not read). It needs no `bun secrets run` wrapper: `packages/worker/scripts/stats.ts`.
- The Worker builds its container from its bindings (`packages/worker/src/workerContainer.ts`) and resolves
  `GITHUB_CLIENT_SECRET` with `resolveOptionalSecret`, since it runs without it.
- Only external tools get secrets as environment variables, through `bun secrets run`: wrangler (`scripts/withSecrets.sh`,
  `secrets:put:prod`), the Tauri build (`build:desktop:signed`).

`scripts/withSecrets.sh` wraps the Worker's `dev` and `preview`; the desktop app needs no secret. It uses `secrets run`, or warns and runs the command without the store when the store cannot be read or lacks a
secret, so a
machine with no access still works: the token form signs in on the web, and the Worker's auth endpoints answer
500 `not_configured`.

`wrangler dev` binds only the names under `secrets.required` in `packages/worker/wrangler.jsonc`, so a new secret
the Worker reads goes there too, which also makes `wrangler deploy` require it in production.

## No `.env`

The repo keeps no env file. A leftover root `.env` still wins over the store (Bun and Nx load it into the
environment, and `secrets list` reports its names `overridden by environment`): delete it.

Links in the document below are relative to `nzyme/docs/practice/`; package READMEs are `nzyme/packages/<pkg>/README.md`.

!`cat nzyme/docs/practice/secrets.md`
