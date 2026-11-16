# Journal — iPhone and Android app

Append-only. One line per decision, rejection or answer from the owner.

- 2026-11-15 — Owner's opening request (translated): build a mobile app, a hybrid one with a WebView; another agent
  is doing the phone layout. iOS first so it can be tried on an iPhone, then Android. Question: ship all the code
  inside the app, or just a WebView onto the site with caching?
- 2026-11-15 — Found: the desktop app already decided this (githq D23: bundled, thin webview rejected); the phone
  layout design already says the hybrid app shows the same layout (mobile D8). Recommended bundling; named the cost —
  no self-updater on iOS, every change through review.
- 2026-11-15 — Owner: the app is for publishing, must pass every check; has a paid Apple Developer account. Recorded
  D1 (bundled, published, iOS first) and D2 (Tauri, proposal). README written up to here. Next: signing in on a
  phone.
- 2026-11-15 — App Review findings (2026-11-15, guidelines page; 4.8 from a summary of the page, not verbatim): 4.8
  exempts "a client for a specific third-party service", so no Sign in with Apple; 2.1(a) needs "demo account info …
  if your app includes a login", demo mode only "with prior approval by Apple". GitHub's mandatory 2FA covered code
  contributors only ("If you didn't receive a notification, then you were not part of a group required to enable
  2FA" — docs.github.com, configuring 2FA), so a fresh reviewer account that contributes no code can likely sign in
  without 2FA; not guaranteed. Not yet a decision.
- 2026-11-15 — Owner: sign in through the Worker (D3), Device Flow rejected for the phone. Mechanism (system sign-in
  sheet, Worker bounce to `githq://`, PKCE) recorded as the design agent's proposal. Open: does the desktop app follow.
- 2026-11-15 — Owner: unify — the desktop app moves to the web flow through the Worker too, Device Flow removed (D4).
  Marked the sign-in part of githq D23 superseded in place (that folder still uses inline supersession notes).
  `docs/decisions/usage-statistics-with-an-opt-out.md` and `docs/desktop/RELEASING.md` mention the Device Flow as
  built; they change with the implementation, not here. Next: Keychain / Tauri plugins on iOS.
- 2026-11-15 — Checked: the desktop's `keyring` crate has iOS and Android stores, so the token keeps the desktop's
  code path; recorded under D2. Only the iOS sign-in sheet needs our own Swift. D2 still awaits the owner.
- 2026-11-15 — Owner confirmed Tauri (D2) and took builds as the next topic. Checked (2026-11-15): TestFlight allows
  "up to 100 internal testers" and a build "becomes unavailable for testers after 90 days"; review language appears
  only for external testing (no-review for internal not stated verbatim); `CFBundleShortVersionString` is "three
  period-separated integers", so no `-dev.N`; `CFBundleVersion` is one to three integers (uniqueness per upload not
  found stated); altool upload is current; Tauri documents `tauri ios build --export-method app-store-connect` and
  `xcrun altool --upload-app … --apiKey … --apiIssuer` (v2.tauri.app/distribute/app-store/), no CI recipe.
  Proposed to the owner: Development stream → TestFlight, Stable → App Store, version `0.3.0` + build number N.
- 2026-11-15 — Owner: release to the App Store automatically after approval. Recorded D5 (Development → TestFlight,
  Stable → App Store, version split into `x.y.z` + build number). README folded up to here.
- 2026-11-15 — Reviewer account, checked (2026-11-15, docs.github.com "Verifying new devices when signing in", via a
  summarising fetch): an account without 2FA may get an emailed code "when you access your account from an
  unrecognized device for the first time"; "GitHub will not ask you to perform device verification when you have 2FA
  enabled, or when you sign in using a passkey"; recovery codes are single-use. So neither a plain account nor a TOTP
  account lets an Apple reviewer sign in through GitHub's page unaided. Put to the owner: a token sign-in for the
  reviewer vs a dedicated mailbox vs demo mode.
- 2026-11-15 — Owner: token sign-in for reviewers, phone app only (D6). Next put to the owner: how the phone build
  differs from the desktop build (a target of its own or the desktop target deciding at run time).
- 2026-11-16 — Owner accepted a fourth build target `mobile` (D7). README now has the build order and what is left
  for later; folded up to here. Next: rightsize, then propose closing.
