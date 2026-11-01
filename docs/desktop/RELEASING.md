# Releasing the desktop app

The desktop app (`packages/desktop`, decision [D21](../design/githq/DECISIONS.md#d21)) is released from a version
tag. CI builds every platform into a draft GitHub release, and you publish it by hand. Installed apps update from
the release GitHub marks "latest".

## Releasing a version

1. On an up-to-date `main`, tag and push:

   ```sh
   git switch main && git pull
   git tag v0.2.0 && git push origin v0.2.0
   ```

   The version comes from the tag only: CI writes it into `tauri.conf.json` before building. The committed
   `version` there is just for local builds.

2. The tag runs `.github/workflows/release.yml`:
   - `spa` builds the desktop SPA once on Ubuntu (`bun --cwd packages/app build:desktop`, with the repository
     variable `GITHQ_GITHUB_CLIENT_ID`), and fails if the variable is missing;
   - `draft` creates the draft release `githq v0.2.0`, marked as a prerelease when the tag has a `-`;
   - `bundle` builds on GitHub-hosted runners: macOS Apple Silicon and Intel (`.dmg`, `.app.tar.gz`), Windows x64
     (NSIS `-setup.exe` only), and Linux x64 (`.AppImage`, `.deb`, `.rpm`). Each build signs its updater bundles
     (`.sig`) and adds itself to the release's `latest.json`;
   - `updater-json` fails the release if `latest.json` lacks a platform: an app on that platform would never
     update.

3. Check the draft under [Releases](https://github.com/kedrzu/githq/releases):
   - the installers for every platform, each updater bundle with its `.sig`;
   - `latest.json` with the right `version` and the platforms `darwin-aarch64`, `darwin-x86_64`, `windows-x86_64`
     and `linux-x86_64`;
   - if you can, install it on your Mac and launch it.

4. Write the release notes and **publish** the draft. Published and not a prerelease, it becomes GitHub's
   "latest". Installed apps read `releases/latest/download/latest.json` at launch and every 4 hours, so they pick
   it up within hours.

A failed run can be re-run from the Actions tab: it finds the draft its first run made. To start over, delete the
draft release and the tag (`git push origin :refs/tags/v0.2.0`), then tag again.

### Prereleases for testing

Tag `v0.2.0-rc.1`, `v0.2.0-rc.2`, …: the same workflow makes a draft **prerelease**. Publish it to share the
installers. GitHub never marks a prerelease "latest", so installed apps are never offered it. Delete the
prerelease and its tag once the real version is out.

## Local development

- `bun run dev:desktop` — the app in a desktop window, against `nuxt dev` (http://localhost:8787, hot reload).
  Sign-in needs `GITHUB_CLIENT_ID` in the root `.env`: the client ID of the OAuth App "githq (dev)", with Device
  Flow enabled (below). The updater is off in dev.
- `bun run build:desktop` — a local installer for this machine, under
  `packages/desktop/src-tauri/target/release/bundle/`. It needs no signing key: the signed updater bundles are
  switched on only in CI.

Both need Rust (`rustup`) and, on Linux, Tauri's
[prerequisites](https://v2.tauri.app/start/prerequisites/#linux).

## One-time setup

### Device Flow on both OAuth Apps

On GitHub → Settings → Developer settings → OAuth Apps, open **githq** and **githq (dev)** and tick **Enable
Device Flow**. Without it, sign-in fails (GitHub answers `device_flow_disabled`). The desktop app uses the same
OAuth Apps as the web, but needs only their public client ID and never the secret.

### Repository variable

`GITHQ_GITHUB_CLIENT_ID`: the client ID of the production OAuth App "githq" (Settings → Secrets and variables →
Actions → Variables). Already set.

### Updater key

The updater bundles are signed with a minisign key. Its public half is `plugins.updater.pubkey` in
`packages/desktop/src-tauri/tauri.conf.json`. The private key and its password were generated into
`~/.githq-secrets/` (`updater.key`, `updater.key.password`) on the owner's Mac and set as the repository secrets
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

**Back both files up to a password manager.** GitHub secrets can't be read back. If the key is lost, installed
apps can never update again: they accept only updates signed by this key, so every user would have to reinstall
by hand from a build with a new key.

### Apple signing and notarization (once the Developer ID exists)

Without these secrets the macOS app is ad-hoc signed (`bundle.macOS.signingIdentity: "-"`), and macOS calls it
from an unidentified developer. With them, the `bundle` job signs and notarizes. Follow Tauri's
[macOS code signing](https://v2.tauri.app/distribute/sign/macos/) guide:

1. Join the Apple Developer Program. Create a **Developer ID Application** certificate and install it in your
   keychain.
2. Export it from Keychain Access as a `.p12` with a password, and base64 it: `base64 -i certificate.p12 | pbcopy`.
3. Set the repository secrets:
   - `APPLE_CERTIFICATE` — the base64 `.p12`;
   - `APPLE_CERTIFICATE_PASSWORD` — its export password;
   - `APPLE_SIGNING_IDENTITY` — the certificate's name, `Developer ID Application: Name (TEAMID)`;
   - `APPLE_ID` — the Apple Account email;
   - `APPLE_PASSWORD` — an app-specific password from account.apple.com, not the account password;
   - `APPLE_TEAM_ID` — the team ID.

The workflow exports each one only when it is set: an empty `APPLE_CERTIFICATE` would fail the bundle. Then
update the macOS line in the root README's download section and its Code signing policy.

### Windows signing through SignPath Foundation (follow-up)

SignPath Foundation signs open-source projects for free, with a certificate issued to the foundation. Its
conditions are at [signpath.org/terms](https://signpath.org/terms.html), summarised in D21.

1. Before applying, settle the licensing question in D21: SignPath requires a license "without commercial
   dual-licensing", and the root README offers a commercial license.
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
