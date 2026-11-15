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
