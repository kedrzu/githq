# githq architecture

githq is a fast, keyboard-first client for GitHub Issues, Projects, pull requests and Actions, for individuals and small teams who already live on GitHub. GitHub is the only source of truth: the browser and desktop apps hold a local cache that can be rebuilt from it, and the one Worker stores nothing.

## Stack

- **Runtime and package manager:** Bun, with Bun workspaces.
- **Language:** TypeScript, ESM.
- **Framework packages:** `@nzyme/*`, built from source from the `nzyme/` git submodule.
- **Build orchestration:** Nx, without a daemon, with its cache in each worktree.
- **Frontend:** Nuxt 4 and Vue, a static SPA plus one prerendered landing page; SCSS.
- **Data:** GitHub through GraphQL (generated SDK) and REST conditional requests; an in-memory store backed by IndexedDB.
- **Hosting:** a Cloudflare Worker on https://githq.dev serves the static app and the OAuth token exchange. The desktop app is Tauri.

## Packages

|Package|Path|Owns|
|-|-|-|
|`@githq/app`|`packages/app`|The Nuxt app: screens by feature, the store, the sync engine, components and their stories. It holds no credentials.|
|`@githq/github`|`packages/github`|The GitHub client: `.gql` operations, the committed schema, the generated SDK, the requester, rate limits and OAuth helpers.|
|`@githq/worker`|`packages/worker`|The Cloudflare Workers: the signed-in/landing choice at `/`, the OAuth token exchange, the `www` redirect. Stateless.|
|`@githq/desktop`|`packages/desktop`|The Tauri shell around the app's desktop build, and its native commands.|
|`@githq/e2e`|`packages/e2e`|Playwright tests of the built app against a mocked GitHub, and the screen harnesses.|

## App and UI

The app builds with `nuxt generate` for one of three targets (`GITHQ_TARGET`): `production`, `local` (adds the development sign-in, for e2e) and `desktop`. Each has its own output folder and a script that checks the result. `/` is prerendered signed out into `_landing.html`; every other route and `index.html` stay a SPA. Why: `docs/decisions/prerendered-landing-and-signed-in-hint.md`.

Routes live only in `app/router.options.ts`; a file Nuxt would route fails the build. Nothing is auto-imported. `plugins/iocPlugin.ts` creates the one IoC container, and other plugins state `dependsOn: ['ioc-plugin']`.

Every screen reads the local store, and the sync engine refreshes it in the background, so navigation never waits on the network. The exception is a repository only browsed, not tracked: no sync loop touches it, and its screen reads GitHub itself, on demand, while it is on screen (`docs/design/githq/DECISIONS.md` D34). Its rows still live in the local store, so re-entering shows them at once, but the first read of a section waits on GitHub. Components have stories that run as tests in a real Chromium, with axe failing a story on an accessibility violation. Tokens are in `styles/tokens.scss`, injected through `viteShared.ts`. The product design is in `docs/design/`.

## Integrations

- **GitHub:** `packages/github` holds the client. Users' tokens come from the sign-in and stay on their device.
- **GitHub OAuth Apps:** `githq` in production and `githq (dev)` in development. `GITHQ_ENV` (`prod`, `dev`, or `e2e` for the tests' dummy) picks one. Client IDs are public, in `packages/github/src/oauthClientIds.json`; the Worker, the desktop build and its native side all read that file. Client secrets are in the secret store, and production's is also a Worker secret.
- **Cloudflare:** Workers and static assets; `packages/worker/wrangler.jsonc`.
- **Bitwarden Secrets Manager:** the OAuth Apps' client secrets and the desktop updater's signing key, read through `@nzyme/secrets` (`secrets` skill). Provider: `scripts/secrets.ts`.

## Tooling and workflow

- **Setup:** `zsh setup.sh` catches a worktree up with `main`, copies local files, checks out the pinned submodule, builds and generates the code map. `setup.build.sh` is the build half, which CI runs too.
- **Checks:** `.github/workflows/checks.yml` holds them, as parallel jobs: the static checks (typecheck, lint, format, the production build), tests, component tests, e2e in three Playwright shards and the desktop app's Rust checks. They run on a pull request that is ready for review (`pr.yml`, nothing on a draft, only lint and format when no code changed) and on each push to `main` before it deploys (`deploy.yml`). The `verify` skill is the protocol.
- **Build cache:** `scripts/nxInputs.test.ts` fails when a cached task stops being invalidated by its own sources or by the nzyme packages it uses.
- **Git:** one task, one worktree, one branch, one squash-merged pull request with a Conventional Commits title (`git-workflow` skill). A commit moving the gitlink moves the nzyme pin.
- **Agents:** `AGENTS.md`, the skills under `.claude/skills/`, and the shared settings in `.claude/settings.json`.

## Decisions

- **Project instructions live in `AGENTS.md`.** Claude Code loads it in this repo, and other agents read the same file.
- **Markdown is formatted by ESLint.** `lint` and `lint:check` cover it through the `markdown()` preset; `format:md` runs only that part, and `format` includes it.
- **There is no separate UI package.** One app uses the components, so they live in `packages/app`.
- **Pull requests do not run component tests or e2e.** They are the slow part of the checks, and they run before each deploy.
- **Stories and the e2e screens are checked with axe, as errors:** WCAG 2.2 AA and axe's best practices (`packages/app/testing/accessibilityTags.ts`). Stories leave out the three rules that judge a whole page; `packages/e2e/src/accessibility/` checks those on real screens, in the layers a story can't reach, and walks Tab through them. `packages/app/styles/tokens.test.ts` holds the contrast of what axe doesn't measure: icons, outlines, graph lines. Decision: `docs/design/githq/DECISIONS.md` D30.
- **Client secrets live in Bitwarden Secrets Manager, in one project shared with the owner's other repos, each key prefixed `GITHQ_` and suffixed with its environment (`_DEV`, `_PROD`).** It is the one store `@nzyme/secrets` implements, and a machine-account token cannot reach vault items. A worktree reads it through the keychain, so no credentials are copied between checkouts. Cloudflare cannot give a secret back, so the store is the only readable copy of production's, which `secrets:put:prod` pushes to the Worker. `.env` still wins where it exists, until [#118](https://github.com/kedrzu/githq/issues/118) removes it.
- **`bun run dev` works without access to the store.** The repo is open to contributors who have no Bitwarden account, so `scripts/withSecrets.sh` warns and goes on; the development token form signs them in.
- **`wrangler.jsonc` declares the Worker's secrets under `secrets.required`.** It is what lets `wrangler dev` read them from its environment without binding the whole shell, and it makes a deploy fail when production lacks one.
- **Prerendering is hybrid, not `ssr: true` everywhere.** Only the landing page is public and needs search engines to see it.
