# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the decision's ID alone, so
`DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired decisions, the journal and notes from
reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history they link to.**
Reopening a rejected option is right when its premise changed; repeating it without knowing it was rejected is not.

## D1

**The phone app ships the built web app inside its bundle, as the desktop app does, and is published on the App
Store (later Google Play) for anyone; iOS comes first.** (2026-11-15, owner: published, must pass every review check,
paid Apple Developer account; bundling was the design agent's recommendation, accepted by the owner)

**Why.** The three reasons the desktop app rejected a thin webview hold on a phone unchanged
([githq D23](../githq/DECISIONS.md#d23)): it cannot start offline, the code holding a `repo`-scoped token would be
whatever githq.dev serves at that moment, and native APIs (the Keychain) would be reachable from a remote origin.
On top of that, App Review turns down repackaged websites, and the app is meant to be published.

> **Checked 2026-11-15:** App Review Guidelines 4.2: "Your app should include features, content, and UI that elevate
> it beyond a repackaged website." 2.5.2: apps may not "download, install, or execute code which introduces or
> changes features or functionality of the app" —
> [guidelines](https://developer.apple.com/app-store/review/guidelines/).

Consequence accepted: no self-updater on iOS; every web change reaches the phone only with a new build through
review, so the app trails githq.dev.

> **Checked 2026-11-15:** a free Apple ID can install a build from Xcode, but "You can register up to 3 devices,
> which expire after 7 days" — [compare memberships](https://developer.apple.com/support/compare-memberships/). Moot:
> the owner has the paid program.

**Rejected.**

- A thin WKWebView loading githq.dev, with the browser's cache — updates for free, but the three desktop reasons
  above plus the 4.2 risk for a published app. Would win only for an app that never goes to the public store.
- Downloading new web bundles over the air into a bundled app — 2.5.2 forbids code that changes features, and it
  brings back "the code is whatever we serve today".

## D2

**The phone app is built with Tauri v2, as further targets of the existing desktop project, not with Capacitor or a
native app.** (2026-11-15, design agent's proposal, not yet confirmed by the owner)

**Why.** The desktop app's native side — the Device Flow, opening links, deep links — is Rust in
`packages/desktop/src-tauri`, and the SPA talks to it through one bridge (`packages/app/desktop/NativeBridge.ts`).
Tauri's mobile targets reuse both; Capacitor would start the native side from nothing.

> **Checked 2026-11-15:** mobile ships in Tauri 2.0, with caveats: "We are not completely happy about the developer
> experience at the moment" and "On mobile not all of the official plugins are supported" —
> [Tauri 2.0](https://v2.tauri.app/blog/tauri-20/). Deep links support iOS, universal links and custom schemes —
> [deep linking](https://v2.tauri.app/plugin/deep-linking/). The updater's setup is guarded by `#[cfg(desktop)]` —
> [updater](https://v2.tauri.app/plugin/updater/). No official Keychain plugin found.

**Rejected.**

- Capacitor — mature on mobile, but none of the desktop's native code carries over. Would win if Tauri's iOS target
  blocks something we need.
