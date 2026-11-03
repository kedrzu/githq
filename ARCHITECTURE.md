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

Every screen reads the local store, and the sync engine refreshes it in the background, so navigation never waits on the network. Components have stories that run as tests in a real Chromium, with axe failing a story on an accessibility violation. Tokens are in `styles/tokens.scss`, injected through `viteShared.ts`. The product design is in `docs/design/`.

## Integrations

- **GitHub:** `packages/github` holds the client. Users' tokens come from the sign-in and stay on their device.
- **GitHub OAuth Apps:** `githq` in production, whose credentials are Worker secrets, and `githq (dev)` in development, whose credentials are in the root `.env` (gitignored), which `setup.sh` copies into every worktree.
- **Cloudflare:** Workers and static assets; `packages/worker/wrangler.jsonc`.

## Tooling and workflow

- **Setup:** `zsh setup.sh` catches a worktree up with `main`, copies local files, checks out the pinned submodule, builds and generates the code map. `setup.build.sh` is the build half, which CI runs too.
- **Checks:** `typecheck`, `lint:check`, `format:check` and `tests` run on every pull request (`.github/workflows/build.yml`). Each push to `main` runs those plus component tests, e2e and the desktop app's Rust checks before it deploys (`deploy.yml`). The `verify` skill is the protocol.
- **Build cache:** `scripts/nxInputs.test.ts` fails when a cached task stops being invalidated by its own sources or by the nzyme packages it uses.
- **Git:** one task, one worktree, one branch, one squash-merged pull request with a Conventional Commits title (`git-workflow` skill). A commit moving the gitlink moves the nzyme pin.
- **Agents:** `AGENTS.md`, the skills under `.claude/skills/`, and the shared settings in `.claude/settings.json`.

## Decisions

- **Project instructions live in `AGENTS.md`.** Claude Code loads it in this repo, and other agents read the same file.
- **Markdown is formatted by ESLint.** `lint` and `lint:check` cover it through the `markdown()` preset; `format:md` runs only that part, and `format` includes it.
- **There is no separate UI package.** One app uses the components, so they live in `packages/app`.
- **Pull requests do not run component tests or e2e.** They are the slow part of the checks, and they run before each deploy.
- **Stories are checked against WCAG 2.1 AA; target size is deferred.** Adding `wcag22aa` fails 35 tests, and larger targets affect the dense lists, so it needs a design decision first: [#119](https://github.com/kedrzu/githq/issues/119).
- **Development credentials stay in `.env` for now.** Moving them to Bitwarden and removing the files are planned: [#117](https://github.com/kedrzu/githq/issues/117), [#118](https://github.com/kedrzu/githq/issues/118).
- **Prerendering is hybrid, not `ssr: true` everywhere.** Only the landing page is public and needs search engines to see it.
