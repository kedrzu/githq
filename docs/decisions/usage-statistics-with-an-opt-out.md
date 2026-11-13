# Usage statistics with an opt-out

## Status

Accepted (2026-11-13).

## Context

githq had no idea how many people use it: GitHub is the only backend, the app talks to `api.github.com` directly, and
the only server is the stateless Worker on githq.dev. The owner wants to know roughly how many people sign in, come
back and download the desktop app, without collecting anything about who they are or what they work on, and with a
switch to turn it off. Until now the docs, the README and the landing page promised "no analytics, no telemetry".

Facts the decision rests on:

- Workers Analytics Engine's free tier allows 100,000 data points written a day, and the data is kept for three
  months (Cloudflare's Workers pricing page, checked 2026-11-01). The Worker writes with
  `writeDataPoint`, which is fire-and-forget, so it stays stateless and a sign-in waits for nothing.
- Cloudflare Web Analytics is cookieless and stores nothing in the browser, but it records each page's path. githq's
  addresses are GitHub's (`/owner/repo/issues/12`), so in the app a path names a repository, private ones included.
- The desktop app signs in with GitHub's device flow, straight with `github.com`; the Worker takes part only when it
  revokes the token at sign-out. The desktop webview is not on githq.dev.
- Installer downloads already go through the Worker (`/download/<build>` redirects to the latest Stable release), and
  nobody is signed in there.

## Options Considered

- **Cloudflare Web Analytics everywhere, the app included**: one script, no code. Rejected: it would record app paths,
  which name private repositories, and it can't run in the desktop app.
- **An own beacon from the app to the Worker, with route names instead of paths**: would count screens and returning
  users per day. Rejected: a second channel out of the app, more to explain and to keep honest, for numbers the owner
  doesn't need yet.
- **Hashed logins or repositories, for unique users**: would answer "how many people" exactly. Rejected by the owner: a
  hash of a GitHub login is still an identifier anyone can recompute.
- **Count in the Worker on the OAuth operations it already handles, plus Web Analytics on the public pages only**:
  sign-ins, sign-outs and downloads become anonymous counts with no new request; visits are counted only where the
  path names nothing private. Chosen.

## Decision

- **Events.** `USAGE_EVENTS` in `packages/github/src/usageStatistics.ts`: `token_created` (the web sign-in's code
  exchange succeeded), `token_refreshed` (a renewal of the 8-hour token through `/api/auth/refresh` succeeded, web or
  desktop), `token_revoked` (a sign-out revoked the token, web or desktop) and `installer_download` (a
  `/download/<build>` redirect).
  `recordUsage()` in `packages/worker/src/usage.ts` writes `blobs: [event, client, installer]`, `doubles: [1]`,
  `indexes: [event]` to the `githq_usage` dataset, and nothing else: no login, IP address, User-Agent, country, code,
  token or repository.
- **Opt-out.** **Settings → Privacy → Share usage statistics**, on by default, stored in the account's settings
  (`TrackingStore`) and synced through `githq-settings` when saving settings is on. `UsageStatisticsFlag` mirrors it
  into a `localStorage` flag on githq.dev, which survives signing out; an account that never chose takes the flag's
  "off". `AuthStore` adds `telemetry: false` to the token exchange, the refresh and the revocation when the flag is set, and the
  Worker then writes nothing.
- **Web Analytics.** `getBeaconLoaderScript()` loads Cloudflare's beacon only on the host githq.dev, only when the flag
  is not set, and only in the prerendered landing page and the docs site, never in the app shell.
- **Downloads** are counted with no opt-out: the request is anonymous and signed out, like Cloudflare's own request
  log of it.
- The docs page `how-it-works/privacy-and-permissions#usage-statistics` lists every event; a test in
  `packages/docs/lib/usageStatistics.test.ts` fails when an event is missing from it.

## Consequences

- No unique users: the counts say how many sign-ins, renewals and sign-outs happened, not how many people made them.
- Desktop sign-ins are not counted, since they never reach the Worker; desktop use shows only in renewals, sign-outs
  and downloads.
- On a new device, before the user's saved settings load, githq doesn't know their choice, so the first sign-in there
  is counted even if they turned statistics off elsewhere.
- Forged events are accepted where they are cheap. A download counts for any request to `/download/<build>`, and the
  web or desktop split trusts the `Origin` header. A sign-in needs a real code from GitHub, a renewal a real refresh token and a sign-out a real token:
  a revocation counts only when GitHub answers 204, not the 404 it gives any made-up token. Accepted: the numbers steer the product, nothing bills
  or authorizes on them.
- The docs, the README and the landing page no longer say githq collects nothing; they say what it counts and how to
  turn it off.
