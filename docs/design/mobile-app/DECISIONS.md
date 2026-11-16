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
native app.** (2026-11-15, design agent's proposal, confirmed by the owner the same day)

**Why.** The desktop app's native side — the Device Flow, opening links, deep links — is Rust in
`packages/desktop/src-tauri`, and the SPA talks to it through one bridge (`packages/app/desktop/NativeBridge.ts`).
Tauri's mobile targets reuse both; Capacitor would start the native side from nothing.

> **Checked 2026-11-15:** mobile ships in Tauri 2.0, with caveats: "We are not completely happy about the developer
> experience at the moment" and "On mobile not all of the official plugins are supported" —
> [Tauri 2.0](https://v2.tauri.app/blog/tauri-20/). Deep links support iOS, universal links and custom schemes —
> [deep linking](https://v2.tauri.app/plugin/deep-linking/). The updater's setup is guarded by `#[cfg(desktop)]` —
> [updater](https://v2.tauri.app/plugin/updater/). No official Keychain plugin found.

> **Checked 2026-11-15:** the desktop keeps the token with the `keyring` crate 4.2
> (`packages/desktop/src-tauri/Cargo.toml:15`, `src/credentials.rs`). Its companion stores cover both phones:
> `apple-native-keyring-store` ("On iOS there is just one secure store: the 'protected data' store") and
> `android-native-keyring-store` (SharedPreferences and the Keystore; the app must first initialise `ndk-context`'s
> application context, so some Kotlin glue) — [docs.rs](https://docs.rs/apple-native-keyring-store/latest/apple_native_keyring_store/),
> [docs.rs](https://docs.rs/android-native-keyring-store/latest/android_native_keyring_store/). Read through a
> summarising fetch, not verbatim; entitlements not checked. So the token store is not where Tauri falls short; the
> one native piece with no maintained wrapper is iOS's sign-in sheet ([D3](#d3)), a small Swift plugin of our own.

**Rejected.**

- Capacitor — mature on mobile, but none of the desktop's native code carries over. Would win if Tauri's iOS target
  blocks something we need.

## D3

**The phone app signs in with GitHub's ordinary web flow through our Worker, the way the website does, not with the
Device Flow the desktop app uses.** (2026-11-15, owner)

How, as the design agent proposes it (not yet confirmed): the app opens GitHub's consent screen in an
`ASWebAuthenticationSession` (iOS's system sign-in sheet, which shares Safari's cookies, so a user signed in to
GitHub in Safari only taps Authorize). GitHub returns to a githq.dev path under the registered callback, which the
Worker answers with a redirect to the app's own scheme (`githq://…`) carrying the code and `state`; the sheet hands
that address to the app. The app trades the code for tokens at the Worker's token endpoint, with PKCE, so a code
caught by another app that claimed the same scheme is worthless without the verifier the app kept.

**Why.** On a phone the Device Flow means copying a code, pasting it on github.com and coming back — three steps
more than one tap on Authorize, on the very first screen a new user meets. The cost the desktop app avoided — the
token passing through our Worker — is already paid on the web, and by the desktop app too since GitHub's tokens
expire after 8 hours and every refresh goes through the Worker ([githq D1](../githq/DECISIONS.md#d1)).

> **Checked 2026-11-15:** GitHub supports PKCE on the OAuth App web flow since 2025-07-14, optional, `S256` only —
> [changelog](https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/). The
> token request still lists `client_secret` as "Required", so PKCE adds to the Worker's exchange, it does not replace
> it — [authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).
> A `redirect_uri` may point at "a subdirectory of the callback URL" on the same host and port (with wildcard
> matching on); nothing on that page allows a custom scheme as the callback, hence the Worker's bounce.

> **Checked 2026-11-15:** the token endpoint answers only the app's own origin, while refresh and revoke answer
> every origin because the desktop webview calls them — `packages/worker/src/githubOAuth.ts:117-125,171`. The phone
> app's origin is not githq.dev. The native side runs the exchange (design agent, stated to the owner 2026-11-15
> without objection), so the endpoint's same-origin guard stays as it is.

> **Checked 2026-11-15:** `ASWebAuthenticationSession` exists since iOS 12; an `https` callback
> (`Callback.https(host:path:)`) only since iOS 17.4 —
> [Apple](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession/callback/https(host:path:)).
> No official Tauri plugin wraps it; the community `tauri-plugin-auth-session` 0.2.2 does (3 stars, last push
> 2026-03-23) — [crates.io](https://crates.io/crates/tauri-plugin-auth-session).

**Rejected.**

- The Device Flow, as on the desktop — no client secret and the token never touches the Worker, but copying and
  pasting a code on a phone is too clumsy for a first sign-in (owner).

## D4

**The desktop app signs in the same way as the phone app: GitHub's web flow through the Worker, with PKCE, landing
back in the app through the `githq://` address; the Device Flow goes from githq entirely.** (2026-11-15, owner)

On the desktop the consent screen opens in the system browser, and the Worker's bounce to `githq://` reaches the
app through the deep link it already registers ([desktop deep links](../../decisions/desktop-deep-links-and-web-hand-off.md)).
The Worker's callback path, its bounce and the PKCE exchange are one mechanism for both apps; only what opens the
consent screen differs (iOS's sign-in sheet, the desktop's browser).

**Why.** The desktop's reason for the Device Flow — the token never passes through our server — stopped holding once
every 8-hour refresh went through the Worker ([D3](#d3)). One way to sign in in the native apps is one thing to
build, test and explain.

**Rejected.**

- Keeping the Device Flow on the desktop next to the web flow on the phone — it works and costs nothing to keep, but
  two sign-ins to maintain for no remaining reason (owner; the design agent had recommended keeping it).
- A loopback redirect on the desktop (a local port catching the callback) — rejected for the desktop originally
  because it needed the client secret in the app; with the Worker doing the exchange that is gone, but it would
  still be a second mechanism beside the phone's.

## D5

**The iPhone app follows the desktop's two streams: every Development build also goes to TestFlight, and every
Stable release is submitted to the App Store and released automatically once Apple approves it. Its version is the
desktop's version split in two: `0.3.0` as the version, the count of commits on `main` as the build number.**
(2026-11-15, streams and versions the design agent's proposal, accepted by the owner; release on approval the
owner's pick)

**Why.** The desktop already has the streams, the version arithmetic and the owner's word to release
([desktop releases](../desktop-releases/README.md)); the phone joins them instead of getting a process of its own,
so "wydajemy" stays one word for every platform. TestFlight's internal testers are what the Development stream is on
the desktop: the owner gets every merge on their iPhone. iOS refuses the desktop's `0.3.0-dev.214` as a version, so
the `-dev.N` part moves into the build number, which every upload needs anyway and which only grows.

> **Checked 2026-11-15:** `CFBundleShortVersionString`: "The required format is three period-separated integers,
> such as 10.14.1" — [Apple](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleshortversionstring).
> TestFlight: "up to 100 internal testers"; "Your build becomes unavailable for testers after 90 days" —
> [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview).
> Beta App Review is described only for external testers
> ([external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers));
> no page states verbatim that internal builds skip it.

> **Checked 2026-11-15:** Tauri builds for the store with `tauri ios build --export-method app-store-connect` and
> uploads with `xcrun altool --upload-app --type ios … --apiKey … --apiIssuer …` —
> [Tauri](https://v2.tauri.app/distribute/app-store/); Apple lists altool among the current upload tools —
> [upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds). No CI recipe in
> either.

Consequence accepted: when Apple rejects a release, the desktop already has that version and the phone does not;
the fix ships in the next release.

**Rejected.**

- Holding an approved release for a second word from the owner — control over the moment, but every release becomes
  two steps days apart (owner).
- A release process of the phone's own, separate from the desktop's — a second version line and a second word to
  release, for nothing the shared one cannot do.

## D6

**Apple's reviewers sign in with a token: the phone app, and only the phone app, offers a small "Sign in with a
token" link under the main sign-in, reusing the token form that today exists only in the local test build; a
dedicated GitHub demo account with a repository, issues, pull requests and a project supplies the token, given to
Apple in the review notes.** (2026-11-15, design agent's proposal, accepted by the owner; phone only the owner's pick)

**Why.** App Review needs a working demo login (2.1(a): "include demo account info … if your app includes a
login"), and GitHub's own sign-in page stops a reviewer either way: an account without 2FA may be asked for a code
sent to its email from an unrecognised device, and an account with 2FA needs a live code. A token skips GitHub's
page entirely. The web and the desktop have no reviewer, so they get no second way to sign in.

> **Checked 2026-11-15:** "GitHub will not ask you to perform device verification when you have 2FA enabled, or
> when you sign in using a passkey"; without 2FA it may, "when you access your account from an unrecognized device
> for the first time" — [docs.github.com](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/verifying-new-devices-when-signing-in)
> (via a summarising fetch). Recovery codes: "it cannot be reused" —
> [docs.github.com](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication-recovery-methods).
> The token form: `packages/app/auth/DevTokenForm.vue`, built only for `GITHQ_TARGET=local`.

Consequences accepted: a second way to sign in is visible in the published phone app; the demo token must be replaced
before it expires, or the next review fails.

**Rejected.**

- A demo account without 2FA plus a mailbox whose password goes to Apple, so the reviewer reads the code themselves
  — no app change, but two sign-ins for the reviewer, and a fiddly demo is a common reason for rejection.
- A demo mode on the mocked GitHub the e2e tests use — the nicest for a reviewer, but needs Apple's prior approval
  and ships test code in the published app.
- The token link on every platform — nobody reviews the web or the desktop app (owner).

## D7

**The phone app's web app is built for a fourth target, `mobile`, beside `production`, `local` and `desktop`: native
code shared with the desktop goes into both native targets, and what belongs to one of them only is cut out at build
time. One `mobile` target serves iOS and Android; Tauri settles what differs between them.** (2026-11-16, design
agent's proposal, accepted by the owner)

Shared by both native targets: the bridge to Tauri, the sign-in through `githq://` ([D4](#d4)), the token store, opening
links, the "what changed" list after an update. Desktop only: the updater and its status bar segment, the stream choice
in Settings, the macOS window controls. Phone only: the token link ([D6](#d6)). iOS runs its own build through a
platform config file of Tauri's, so `tauri ios build` builds the `mobile` target.

**Why.** It is how the desktop's code is kept out of the web today — a build target, with a script after the build that
asserts what is absent (`packages/app/nuxt.config.ts:24`, `checkProductionBuild.ts`) — so the same check can prove the
token link never reaches the desktop and the updater never reaches the phone. On the phone the stream is which app you
installed (TestFlight or the App Store, [D5](#d5)), so there is nothing to choose in Settings and no updater to show.

**Rejected.**

- One native build for both, asking Tauri at run time which platform it is on — one build fewer, but the desktop's
  code ships to the iPhone and keeping the token link off the desktop rests on a run-time check rather than on the code
  being absent. Would win if the fourth build became a burden to maintain.
