---
name: verify
description: >-
    How a change is proven to work in githq — a scoped check after each step of work and the full
    protocol before a change is called done (codegen, TypeScript, lint, format, bun tests, Storybook
    component tests, app build with its production check, Worker bundle, desktop build and the desktop
    app's Rust checks, Playwright e2e against a mocked GitHub). The dev pipeline (/dev:*) relies on it; reach for it whenever you need to check
    that the repo is green, before committing a finished change, or when asked to "verify", "make it
    green" or "run the checks".
---

# verify — githq

Fulfils the `verify` contract of the `dev` plugin (`skills/pipeline/references/contracts.md`).

All commands run from the repo root. A package script is `bun --cwd <package> <script>` — **no `run`**:
`bun --cwd <package> run <script>` prints bun's usage banner and exits 0, a silent false green.

If `nzyme/packages/cli/dist` or `packages/app/.nuxt` is missing (fresh clone or worktree), run
`bun run setup` first. Nothing needs local infrastructure: there is no database, and tests never call
the real GitHub.

## Scoped

After each piece of work, while more remains. Covers what the change touched; green here is **not**
a green codebase.

|Check|Command|When|
|-|-|-|
|Generated files|`bun run codegen`|a `.loc.yaml`, a `.gql` operation or a package's dependencies changed|
|TypeScript (packages)|`bun run build`|always (incremental)|
|TypeScript (app, incl. `.vue`, stories, specs)|`bun run typecheck`|anything under `packages/app`|
|Lint|`bun run lint:check`|always (whole repo, fast)|
|Format|`bunx oxfmt --disable-nested-config <changed files>` and `bunx nzyme format-markdown <changed .md>`|always|
|Unit / integration tests|`TZ=UTC bun test --timeout 10000 --path-ignore-patterns='**/dist/**' ./<changed package or test file>` — always with `./`: a bare `packages/x` is a name filter that scans the whole tree|a `*.test.ts` or the code it covers changed|
|Component tests|`bun --cwd packages/app test:stories -- <changed component dir or file>`|a component, its story or spec changed|
|E2E|`bun run e2e <spec files, relative to packages/e2e>`; one test by title: `bun run e2e -g "<title>"`|a screen or flow an e2e spec drives changed, or the harness or the GitHub mock|
|Desktop (Rust)|`mkdir -p packages/app/.output-desktop/public`, then in `packages/desktop/src-tauri`: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`|anything under `packages/desktop`|
|Desktop build|`bun --cwd packages/app build:desktop` (runs `scripts/checkDesktopBuild.ts`); the whole app: `bun run build:desktop` (no signing key needed — the release workflow turns the signed updater bundles on)|`nuxt.config.ts`, the desktop code of the app, or `tauri.conf.json` changed|
|Worker|`bun --cwd packages/app build`, then `bun --cwd packages/worker dev` and `curl -s -o /dev/null -w '%{http_code}' 'http://localhost:8788/api/auth/authorize?state=abcdefghijklmnop0123'` → `302` (with the OAuth App in the root `.env`; `500` without), `curl -s -o /dev/null -w '%{http_code}' http://localhost:8788/some/deep/link` → `200`, `curl -s -o /dev/null -w '%{http_code}' http://localhost:8788/api/unknown` → `404`; stop it after (by PID)|`packages/worker/**` or `nuxt.config.ts` changed|

`*.test.ts` = `bun test`; `*.spec.ts` under `packages/app` = browser component specs run by Vitest
through Storybook; `*.spec.ts` under `packages/e2e` = Playwright; `*.stories.ts` are tests too
(render + a11y as errors).

## Full

Once, when all work is believed complete. Every step, in order, nothing skipped; zero errors each.

|#|Step|Command|Must|
|-|-|-|-|
|1|Codegen|`bun run codegen`|regenerates `*.loc.ts`, the GraphQL `generated.gen.ts` and tsconfigs cleanly; `git status` shows no unexpected diff in generated files|
|2|TypeScript|`bun run build`|zero errors|
|3|App typecheck|`bun nx run-many -t typecheck --exclude='@nzyme/*' --skip-nx-cache`|zero errors|
|4|Lint|`bun run lint`|zero errors (applies fixes)|
|5|Format|`bun run format`, then `bun run format:check`|applied, check clean|
|6|Tests|`bun run tests`|zero failures|
|7|Component tests|`bun nx run-many -t test:stories --exclude='@nzyme/*' --skip-nx-cache`|zero failures (stories + specs + a11y)|
|8|App build|`bun --cwd packages/app build` (runs `scripts/checkProductionBuild.ts`: no dev-only sign-in in the production files), then `bun --cwd packages/worker bundle`, then `bun --cwd packages/app build:desktop` (runs `scripts/checkDesktopBuild.ts`)|all succeed|
|9|Desktop (Rust)|`mkdir -p packages/app/.output-desktop/public` (`tauri::generate_context!()` needs the folder; step 8 made it), then in `packages/desktop/src-tauri`: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`|zero warnings, zero failures|
|10|Storybook build|`bun --cwd packages/app build-storybook`|builds|
|11|E2E|`bun run e2e`|zero failures; see **E2E** below|

Rules:

- **Every red is yours** until proven otherwise; fix it, never skip, suppress or disable.
- **Rewind:** a fix that touches code an earlier step checked sends the run back to that step, then
  forward again.
- `--skip-nx-cache` in steps 3 and 7: a cached green from an earlier tree proves nothing.
- Changes inside `nzyme/` additionally need `bun run lint:nzyme` and nzyme's own tests
  (`bun run --cwd nzyme test`).

## E2E

`bun run e2e` (Playwright, `packages/e2e`) runs two projects. `web` builds the local app
(`bun --cwd packages/app build:local` → `packages/app/.output-local`, which includes the dev token sign-in) and
serves it with the Worker in one `wrangler dev`, with a dummy OAuth App from
`packages/e2e/worker.vars` (never the real `.env`). `desktop` (`src/desktop/`) builds the desktop app's SPA
(`GITHQ_GITHUB_CLIENT_ID=e2e-client bun --cwd packages/app build:desktop` → `packages/app/.output-desktop`)
and serves it with a static server falling back to `index.html`
(`src/desktop/serveDesktopApp.ts`, no Worker); its native side is faked in the page
(`src/desktop/FakeNativeBridge.ts`), and a request to githq.dev or `/api/*` fails the test. Both servers
start whichever project runs; one project alone: `bun run e2e --project=desktop`. Every GitHub host is
answered by the GitHub mock (`src/github/GitHubMock.ts`): an operation or URL a test did not register fails
that test by name. Both servers listen on free ports picked for each run (`src/localApp.ts`), so `bun run dev`
and other worktrees' e2e runs can go on next to it.

A failed test leaves its screenshot and trace in `packages/e2e/test-results/<test>/`:
`bunx playwright show-trace packages/e2e/test-results/<test>/trace.zip` replays it. Tests must pass run
twice in a row and with `--workers=4`.
