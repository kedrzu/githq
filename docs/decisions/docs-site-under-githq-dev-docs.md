# Documentation site under githq.dev/docs, served by the app's Worker

## Status

Accepted (2026-11-09).

## Context

githq needs user documentation. The design (`githq.pen`, frame `I5wWZ`) draws a VitePress site at `githq.dev/docs`:
Markdown pages in the repository, the sidebar, outline, search, "Edit this page" and "Updated" read from the files and
their git history, deployed with every merge. The docs are not versioned: they describe the current release only, so
there is no version picker and no archive of older docs.

githq.dev is one Cloudflare Worker with static assets (D16). Facts the decision rests on, checked 2026-11-09 in
`wrangler dev` (miniflare, wrangler 4.151.0):

- `not_found_handling` is one setting for the whole Worker (`packages/worker/wrangler.jsonc`). It is
  `single-page-application`, which the app's deep links need: any path with no file behind it gets `index.html` with
  200.
- Through the `ASSETS` binding a missing path also comes back as the app's `index.html`, with the same ETag as
  `/index.html`, whether or not the request carries `Sec-Fetch-Mode: navigate`.
- `"run_worker_first": ["/docs/*", "!/docs/assets/*"]` runs the Worker for the docs' pages and leaves their hashed
  assets to the assets layer.
- With `cleanUrls`, `/docs/x` serves `docs/x.html`, `/docs/x.html` redirects to `/docs/x`, and `/docs` redirects to
  `/docs/` before the Worker runs.

Not verified on Cloudflare itself, only in miniflare.

## Options Considered

- **Static only, under `/docs/`.** No Worker code. Trade-off: a mistyped or removed docs address shows the app (its
  shell, then its not-found route) with a 200, instead of the docs' 404.
- **The Worker runs first for `/docs/*`.** It fetches the page through `ASSETS` and answers a miss (a 404, or the
  app shell's ETag) with `docs/404.html` and status 404. Trade-off: every docs page request is a Worker run.
- **A separate site (`docs.githq.dev`, Cloudflare Pages).** Its own 404 handling for free. Trade-off: a second
  deployment and domain, against D16, and the design's address is `githq.dev/docs`.

## Decision

The docs are their own package (`packages/docs`, VitePress, `base: '/docs/'`, `cleanUrls`). The app's production and
local builds build them and copy the output into their `docs/` folder; the desktop build never contains them. The
Worker runs first for `/docs/*` except `/docs/assets/*` and answers a miss with the docs' 404. Docs traffic is small,
and a real 404 keeps search engines and links honest.

The desktop app opens `https://githq.dev/docs/` in the system browser: it is carved out of the githq.dev links the
window shows itself and out of the macOS universal links.

"Updated" dates come from git, so the jobs that build the web app check out full history, and the docs build fails on
a shallow clone rather than stamp one date on every page.

## Consequences

The docs deploy with the app, from one repository and one Worker. Each docs page costs a Worker invocation. The miss
check compares ETags with the app shell; if Cloudflare ever answered a miss through the binding with 404 instead, the
check still holds. CI checkouts are full clones.
