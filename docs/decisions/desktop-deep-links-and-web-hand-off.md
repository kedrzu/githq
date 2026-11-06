# Opening githq links in the desktop app

## Status

Accepted

## Context

The owner wants githq links to open in the desktop app: `githq://` and `https://githq.dev`. Addresses are the same on
githq.dev, in the app and on github.com, so a link needs only its path. A custom scheme is simple on every system. An https
link is the system's decision, and no system offers one answer.

> **Checked 2026-11-06:**
>
> - Tauri's deep-link plugin documents custom schemes for desktop, and Windows and Linux deliver the link as an argument
>   to a new process ([plugin](https://v2.tauri.app/plugin/deep-linking/)), which the single-instance plugin's `deep-link`
>   feature hands over to the running one.
> - Tauri CLI 2.12.4 reads `plugins.deep-link.desktop.domains` for macOS Universal Links
>   ([tauri#14031](https://github.com/tauri-apps/tauri/pull/14031)), and tao has delivered them since 0.34.2
>   ([tao#1108](https://github.com/tauri-apps/tao/pull/1108)).
> - A Developer ID app may use Associated Domains
>   ([Apple's table](https://developer.apple.com/help/account/reference/supported-capabilities-macos/)), authorised by a
>   profile embedded in the bundle ([TN3125](https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles)).
>   An app with the entitlement and no matching profile is killed at launch.
> - Chrome does not hand Universal Links to apps
>   ([Apple's forum, an Apple engineer](https://developer.apple.com/forums/thread/738243)). No primary source was found for
>   Firefox or Arc; we assume the same.

Not checked: Windows' URI handlers beyond needing package identity (an MSIX; we ship NSIS). Delivery of a Universal Link
on a macOS cold start has not been tried on a signed build; if it fails, the app still opens, only not on that screen.

## Options Considered

- **`githq://` only.** The least work. Trade-off: a githq.dev link, which is what people actually share, never reaches the
  app.
- **`githq://` plus Universal Links.** Links from native apps and Safari go straight to the app. Trade-off: nothing for
  Chrome, Firefox, Windows or Linux.
- **`githq://` plus a hand-off through the page, always on.** Every system and browser. Trade-off: browsers don't say
  whether the app is installed, so a visitor without it would be sent nowhere on every visit.
- **All three, with the hand-off as an opt-in per browser.** Each case gets the most direct route the system allows.
  Trade-off: three routes into one behaviour, and an owner's step on developer.apple.com.

## Decision

All three, as they cover different cases and share one way in. Every link becomes an app address in one Rust function, which
refuses anything that could leave the app's origin. The native side keeps the last address until the page takes it
(`link_take`), so a link opened before the page listens is not lost.

The hand-off is decided once per page load, on the first navigation, and only for a signed-in user on a shell screen. It
lives in `LocalPreferences`, not in the synced settings, as another device may not have the app.

Universal Links are added only by the release workflow, and only with the profile set, so that no local or ad-hoc signed
build can carry an entitlement macOS would kill it for.

The file on githq.dev excludes static files by name. Its `*` crosses `/`, so a `/*.*` would also exclude a repository with
a dot in its name (`/vercel/next.js`). `checkAppSiteAssociation.ts` checks this on every production build.

## Consequences

Gained: links open in the app wherever the system allows, and the app needs no server of ours.

Accepted:

- Chrome and Firefox show a browser prompt and leave a tab behind on each hand-off.
- A new static file at the site's root must be added to the exclusions; the build check fails until it is.
- OS registration, single-instance hand-over and Universal Links have no automated test: tests stop at the native bridge
  (faked in e2e) and the mapping function (unit tests). They are checked by hand (`docs/desktop/RELEASING.md`).
