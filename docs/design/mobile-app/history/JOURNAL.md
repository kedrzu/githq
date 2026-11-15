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
