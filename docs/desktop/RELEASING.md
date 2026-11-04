# Releasing the desktop app

The desktop app (`packages/desktop`, decision [D23](../design/githq/DECISIONS.md#d23)) is released on demand by
the Release action. It works out the version from the PR titles, tags `main`, and CI builds every platform into a
draft GitHub release; you publish it by hand. Apps on the Stable stream update from the release GitHub marks "latest". Every
push to `main` also builds the [Development stream](#the-development-stream).

## When to release

The web deploys on every push to `main`. The desktop app is released on demand, when a release is worth a restart
to its users.

## Releasing a version

1. See what the next release would be. On GitHub, Actions → Release → Run workflow (or from the terminal):

   ```sh
   gh workflow run release.yml -f mode=preview
   ```

   `preview` is the default. It releases nothing: the run's summary page shows the next version and its notes.
   With nothing user-visible since the last stable tag it says so.

2. Release it, from `main` (other branches are refused):

   ```sh
   gh workflow run release.yml -f mode=stable
   ```

   The version is worked out from the PR titles since the last stable tag, and the first one is 0.1.0. While 0.x
   a breaking change bumps minor, from 1.0 major; `feat` bumps minor, `fix` and `perf` patch. The scopes `web` and
   `cloud` (see the `git-workflow` skill) do not count. With nothing user-visible since the last stable tag,
   `stable` fails with a clear message and makes no tag. The version comes from the tag only: CI
   writes it into `tauri.conf.json` before building, and the committed `version` there is just for local builds. A
   tag pushed by hand builds nothing.

3. The run (`.github/workflows/release.yml`) has these jobs:
   - `prepare` works out the version and the notes, creates the tag at the commit the run started on, and a draft
     release `githq v0.2.0` with the generated notes;
   - `spa` builds the desktop SPA once on Ubuntu (`bun --cwd packages/app build:desktop`, with `GITHQ_ENV=prod`);
   - `bundle` builds on GitHub-hosted runners: macOS Apple Silicon and Intel (`.dmg`, `.app.tar.gz`), Windows x64
     (NSIS `-setup.exe` only), and Linux x64 (`.AppImage`, `.deb`). Each build signs its updater bundles
     (`.sig`) and adds itself to the release's `latest.json`;
   - `updater-json` fails the release if `latest.json` lacks a platform: an app on that platform would never
     update.

4. Check the draft under [Releases](https://github.com/kedrzu/githq/releases):
   - the installers for every platform, each updater bundle with its `.sig`;
   - `latest.json` with the right `version` and the platforms `darwin-aarch64`, `darwin-x86_64`, `windows-x86_64`
     and `linux-x86_64`;
   - if you can, install it on your Mac and launch it.

5. Edit the release notes if you want to: they are generated from the PR titles, and editable until you publish.
   Then **publish** the draft. Published and not a prerelease, it becomes GitHub's "latest". Installed apps read
   `releases/latest/download/latest.json` at launch and every 4 hours, so they pick it up within hours.

If a build fails, use "Re-run failed jobs" on the run; it continues with the tag and the draft the first attempt
made. "Re-run all jobs" is refused, because it would work out a new version. To start over, delete the draft release
and the tag (`git push origin :refs/tags/v0.2.0`), then run the action again.

There is no way yet to force a version. When 1.0 is near, 1.0.0 needs a small PR that adds an input to the action.

## The Development stream

`.github/workflows/development.yml` runs after the Deploy action succeeds on `main`, unless only documentation changed since the published build. It builds
macOS and Linux, signed and notarized like a release, as a draft under the tag `development`, checks the draft's `latest.json`, then deletes
the published release and publishes the draft. The tag never moves; the description names the commit. Nothing here is done by hand.

The version is the last stable version with its minor raised plus the commit count: `0.3.0-dev.214` after `0.2.0`, `0.1.0-dev.N`
before any stable release. Apps on the stream read `releases/download/development/latest.json`. Windows has no Development builds.

A failed build leaves the last published one in place, and the next run builds everything since it. A newer build cancels an older one,
and the draft it left is removed by the next run that builds. A run never publishes a commit older than the published build.

## Local development

- `bun run dev:desktop` — the app in a desktop window, against `nuxt dev` (http://localhost:8787, hot reload).
  Sign-in uses the OAuth App "githq (dev)" (`GITHQ_ENV` defaults to `dev`), with Device Flow enabled (below). The updater is off in dev.
- `bun run build:desktop` — a local installer for this machine, under
  `packages/desktop/src-tauri/target/release/bundle/`. It needs no signing key: the signed updater bundles are
  switched on only in CI and in `bun run build:desktop:signed`.

Both need Rust (`rustup`) and, on Linux, Tauri's
[prerequisites](https://v2.tauri.app/start/prerequisites/#linux).

## One-time setup

### Device Flow on both OAuth Apps

On GitHub → Settings → Developer settings → OAuth Apps, open **githq** and **githq (dev)** and tick **Enable
Device Flow**. Without it, sign-in fails (GitHub answers `device_flow_disabled`). The desktop app uses the same
OAuth Apps as the web, but needs only their public client ID and never the secret.

### Updater key

The updater bundles are signed with a minisign key. Its public half is `plugins.updater.pubkey` in
`packages/desktop/src-tauri/tauri.conf.json`. The private key and its password live in the secret store (the `secrets`
skill), as `GITHQ_TAURI_SIGNING_PRIVATE_KEY_PROD` and `GITHQ_TAURI_SIGNING_PRIVATE_KEY_PASSWORD_PROD`, mapped only with
`GITHQ_ENV=prod`, so that `bun run dev` never holds them. The store is the only readable copy: GitHub secrets can't be read
back. If the key is lost, installed apps can never update again: they accept only updates signed by this key, so every
user would have to reinstall by hand from a build with a new key.

On any machine, once logged in with `bun nzyme secrets login`:

- `bun run build:desktop:signed` builds the app with signed updater bundles, as a release does, reading the key from the
  store.
- To set or replace the repository secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, which the
  Release action signs with:

  ```sh
  GITHQ_ENV=prod bun nzyme secrets run -- sh -c '
    printf %s "$TAURI_SIGNING_PRIVATE_KEY" | gh secret set TAURI_SIGNING_PRIVATE_KEY
    printf %s "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD'
  ```

### Apple signing and notarization (once the Developer ID exists)

Without these secrets the macOS app is ad-hoc signed (`bundle.macOS.signingIdentity: "-"`), and macOS calls it
from an unidentified developer. With them, the build signs and notarizes. Follow Tauri's
[macOS code signing](https://v2.tauri.app/distribute/sign/macos/) guide:

1. Join the Apple Developer Program. As the Account Holder, create a **Developer ID Application** certificate from a
   certificate signing request made in Keychain Access, and open the downloaded `.cer` to install it.

2. Export it from Keychain Access (My Certificates) as a `.p12` with a password.

3. Put everything in the secret store, under `GITHQ_ENV=prod`, the only place it can be read back from:

   ```sh
   base64 -i certificate.p12 | GITHQ_ENV=prod bun nzyme secrets set APPLE_CERTIFICATE --no-prompt
   GITHQ_ENV=prod bun nzyme secrets set APPLE_CERTIFICATE_PASSWORD --prompt="The .p12's export password"
   GITHQ_ENV=prod bun nzyme secrets set APPLE_SIGNING_IDENTITY --prompt="Developer ID Application: Name (TEAMID)"
   GITHQ_ENV=prod bun nzyme secrets set APPLE_ID --prompt="The Apple Account's email"
   GITHQ_ENV=prod bun nzyme secrets set APPLE_PASSWORD --prompt="An app-specific password from account.apple.com"
   GITHQ_ENV=prod bun nzyme secrets set APPLE_TEAM_ID --prompt="The team ID, developer.apple.com → Membership"
   ```

   `bun run build:desktop:signed` then signs and notarizes on any machine, with no certificate in its keychain.

4. Set the repository secrets from the store, which is what the workflows read:

   ```sh
   GITHQ_ENV=prod bun nzyme secrets run -- sh -c '
     printf %s "$APPLE_CERTIFICATE" | gh secret set APPLE_CERTIFICATE
     printf %s "$APPLE_CERTIFICATE_PASSWORD" | gh secret set APPLE_CERTIFICATE_PASSWORD
     printf %s "$APPLE_SIGNING_IDENTITY" | gh secret set APPLE_SIGNING_IDENTITY
     printf %s "$APPLE_ID" | gh secret set APPLE_ID
     printf %s "$APPLE_PASSWORD" | gh secret set APPLE_PASSWORD
     printf %s "$APPLE_TEAM_ID" | gh secret set APPLE_TEAM_ID'
   ```

The workflow exports each one only when it is set: an empty `APPLE_CERTIFICATE` would fail the bundle. Then
update the macOS line in the root README's download section and its Code signing policy.

### Windows signing through SignPath Foundation (follow-up)

SignPath Foundation signs open-source projects for free, with a certificate issued to the foundation. Its
conditions are at [signpath.org/terms](https://signpath.org/terms.html), summarised in D23.

1. Keep githq AGPL-only: SignPath requires a license "without commercial dual-licensing" (D23). The CLA lets the
   maintainer offer other terms, so say in the application that this right is unused and no commercial license is
   offered.
2. Publish the first public (unsigned) release: SignPath signs only software already released in that form.
3. Make sure the root README's **Code signing policy** is current: the team roles, the privacy statement, and how
   to uninstall.
4. Apply at [signpath.org](https://signpath.org). MFA is required on GitHub and on SignPath.
5. Once accepted, a follow-up PR wires
   [`signpath/github-action-submit-signing-request`](https://github.com/signpath/github-action-submit-signing-request)
   into the Windows `bundle` job, and adds "Free code signing provided by SignPath.io, certificate by SignPath
   Foundation" to the Code signing policy. Every release then waits for a manual approval in SignPath.

The follow-up's design: Tauri's NSIS installer wraps the app's `.exe`, so signing happens twice. First the app
`.exe`, after compiling and before bundling. Then the `-setup.exe` installer, after bundling. The updater
signature (`.sig`) and `latest.json` must be computed over the **signed** installer, so the updater bundle is
signed after SignPath returns it, not by `tauri-action` as today. Product name and version metadata must match
across builds (SignPath's artifact configuration).
