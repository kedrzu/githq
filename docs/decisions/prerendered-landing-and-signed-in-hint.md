# Prerendered landing page at `/`, chosen by a signed-in hint cookie

## Status

Accepted (2026-10-31).

## Context

githq.dev had no public face. `/` is two things at once: GitHub's dashboard address, so in githq it is "My work"
(every githq address is GitHub's), and the first page a visitor, a search engine or a link preview sees. A
signed-out visitor got the SPA shell, paid for the whole app bundle and was then redirected to `/login`. Crawlers
and previews saw an empty page.

The landing page has to be in the HTML of `/` for a signed-out visitor. A signed-in user must get the app there with
no landing flashing first. The session is a token in `localStorage` (`packages/app/auth/AuthStore.ts`), which the
edge cannot see. The only server is the Cloudflare Worker, which so far ran only for `/api/*`, and it must stay
stateless (no server-side sessions, GitHub is the only backend). GitHub has the same problem and solves it with a
non-secret "signed in" cookie that picks the marketing page or the dashboard at the same address.

Facts the decision rests on (checked 2026-10-31 in the installed packages):

- With `ssr: true`, `nuxt generate` emits the SPA shells `200.html` and `404.html`, and `index.html` only when
  `ssr` is false. A hybrid build must list `/index.html` among its prerender routes
  (`@nuxt/nitro-server/dist/index.mjs:840-843`).
- Prerendering `/index.html` always yields the SPA shell (`data-ssr="false"`), so deep links and Cloudflare's SPA
  fallback stay as they were (`@nuxt/nitro-server/dist/runtime/utils/renderer/app.mjs:9-13,28`).
- `prerender:generate` may change a route's `fileName` before the file is written, so `/` can be written as
  `_landing.html` (`nitropack/dist/core/index.mjs:2178-2200`).
- One client bundle serves both pages: it hydrates when `__NUXT_DATA__` carries `data-ssr="true"` and mounts
  otherwise (`nuxt/dist/app/entry.js:37-40`).
- `routeRules['/**']` also matches `/`, and Nitro merges the matching rules, so `/` needs its own `{ ssr: true }`
  next to `'/**': { ssr: false }`, or `_landing.html` comes out as a shell.
- A prerendered page opened with a query hydrates on `/`, then Nuxt replaces the route with the real URL
  (`nuxt/dist/pages/runtime/plugins/router.js:130,246-251`), so `next` and `failed` are read reactively.
- `run_worker_first: ["/"]` compiles to `^/$` and is matched against the pathname, so `/?utm_source=…` runs the
  Worker and no other path does (miniflare `router.worker.js:166-177`). Production is assumed to match miniflare;
  Cloudflare's docs describe the same glob patterns and say nothing contrary.
- With `html_handling: auto-trailing-slash`, `/x` serves `x.html` and `/x.html` redirects to `/x`, so the Worker
  fetches the landing as `/_landing` (miniflare `assets.worker.js:791-866,1139-1145`).
- `wrangler dev --assets <dir>`, which the e2e suite runs, keeps the assets binding and `run_worker_first` from
  `wrangler.jsonc` (wrangler 4.151, `validateAssetsOptions`).

## Options Considered

- **A separate subdomain or path for the app** (`app.githq.dev`, `/app`): no flash and no Worker code, but every
  githq address stops being GitHub's, and people have to remember a second address. Rejected.
- **Static landing at `/` always, the SPA redirecting signed-in users**: simplest, but every signed-in visit paints
  the landing before the app takes over. Rejected: a flash on every visit to home.
- **An inline script in the head that swaps the page for the app when a token is stored**: no server, but it ships
  the landing to signed-in users, blocks the parser, and the landing still has to be hidden until the script
  decides. Rejected.
- **Render the landing component at build time and inject it into the shell**: no SSR in the app, but no real
  hydration (the client re-renders it) and a second render pipeline to maintain. Rejected.
- **A registry of public pages, each prerendered and routed by the Worker**: flexibility for pages we don't have.
  Rejected.
- **Nuxt hybrid rendering with a cookie hint**: `/` prerendered signed out into `_landing.html`, every other route
  a SPA, and the Worker picking the file by a non-secret cookie the app keeps in step with the session. Three
  independent designs (Design-It-Twice) converged on it. Chosen.

## Decision

- **Build.** `ssr: true` exists only to prerender `/`: `routeRules` keep `'/**'` at `ssr: false` and set `'/'`
  to `ssr: true`; prerender routes are `/` and `/index.html` with no link crawling and no payload extraction. A
  `prerender:generate` hook writes `/` to `_landing.html`; `index.html`, `200.html` and `404.html` stay SPA shells.
  Both builds (production and the local one the e2e suite runs) emit them, and their build checks assert it
  (`packages/app/scripts/checkPrerenderedPages.ts`). `nuxt dev` stays a pure SPA.
- **Hint cookie.** `githq_signed_in=1; Path=/; SameSite=Lax; Max-Age=31536000`, plus `Secure` on https
  (`SIGNED_IN_HINT_COOKIE` in `packages/github/src/oauth.ts`). It carries no token and nothing that identifies
  the user. `AuthStore` is its only writer: it sets it whenever a token is stored (sign-in, every app start that
  finds one, another tab signing in) and clears it when the token goes (sign-out, a rejected token, another tab).
- **Worker.** `run_worker_first: ["/api/*", "/", "/_landing"]` with the assets binding `ASSETS`
  (`packages/worker/src/home.ts`). `/` (GET or HEAD, any query) with the hint gets the shell, without it
  `_landing.html`; both with `Cache-Control: no-cache` and `Vary: Cookie`. `/_landing` answers the shell, so the
  landing has no address of its own. Every other path is served by the assets as before.
- **App.** `/` is `HomePage`: the landing when signed out (and always on the server and while hydrating), "My
  work" when signed in. A stale hint therefore still shows the landing, drawn by the SPA, and the cookie is
  cleared. `/login` redirects to `/` keeping `next`, `return_to` and `failed`; signed-out app routes go to
  `/?next=…`; a failed sign-in or rejected token lands on `/?failed=…` with a banner (D21).

## Consequences

- A signed-out visitor, a crawler or a link preview gets the full landing, with its SEO tags, in the first
  response, and it paints before any JavaScript. A signed-in user gets the app at `/` and never sees the landing.
- `/` stays GitHub's dashboard address; there is no second address to remember.
- The app now renders on the server once per build: the plugins, `app.vue`, the auth middleware and the landing
  must stay server-safe (browser APIs only on the client, in `onMounted` or `.client` plugins). A module that
  touches `window` at the top level breaks the build, not the users.
- A browser holding a session but no hint (signed in before this shipped, or cookies cleared) paints the landing
  once, then gets the hint on that app start. Accepted.
- The Worker now runs, and is billed, for every request to `/`, not only `/api/*`. Static assets stay unbilled.
- The hint is a UI hint, not authorization: a wrong one costs one page load, never access.
- `nuxt dev` never server-renders and has no Worker in front of `/`, so it always shows the SPA's landing. The
  prerender and the cookie routing are proven only by the builds (their checks) and the e2e suite
  (`packages/e2e/src/landing/landing.spec.ts`).
