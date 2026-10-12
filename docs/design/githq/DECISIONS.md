# Decisions

Log of decisions, rejections, supersessions and the evidence behind them. Grep, don't read front to back.
Headings are IDs only; the claim is the first line under the heading.

## Decisions

### D1

Users sign in with "Sign in with GitHub" from day one, via a small stateless token-exchange service that holds
the `client_secret` and does nothing else — no task data, no database. All API traffic goes straight from the
browser to `api.github.com`. Answers [Q1](#q1) (user, 2026-10-12: "od razu logowanie githubem").
Rejected: a pasted personal access token as the primary path — onboarding friction, and a classic PAT is a
broad, long-lived credential sitting in the browser (fine-grained PATs can't see user-owned Projects or more
than one owner, so classic would be required). App type: [D3](#d3).
Consistent with the AGENTS.md principle "no server of our own for task data": the service never sees task data.

### D2

The app shows and edits only what GitHub itself has. It invents no conventions: no labels-as-status, no own
priority scale, no fixed Todo/In Progress/Done workflow. Where a GitHub Project defines fields (Status,
Priority, Iteration, or anything else), the app displays and edits those fields as the project defines them.
Without a project, an issue is what GitHub says it is: open/closed, labels, assignees, milestone, type,
parent/sub-issues, dependencies. Source: user, 2026-10-12 ("nie próbujemy tutaj narzucić jakiejś własnej
konwencji"). Rejected: label conventions for status/priority (a second source of truth github.com doesn't
understand). Note: this is broader than "workflow lives in Projects" — project fields are arbitrary per
project, so the UI cannot assume a field called Status exists.

### D3

githq registers as a GitHub **OAuth App**, requesting `repo` and `project` scopes (more only when a feature
needs one). Answers [Q3](#q3) (user, 2026-10-12). Why: the dashboard needs the user's whole footprint —
user-owned Projects, private repos across several orgs, writes (comments, edits) in other people's public
repos — and a GitHub App user token reaches only the intersection with its installations, has no REST access
to user-owned Projects and none to notifications (evidence under Q3).
Accepted costs: `repo` also grants code write (no narrower scope exists for private issue/PR writes), so the
consent screen reads as "full access to repositories"; orgs with OAuth app access restrictions (default for
new orgs) hide their private resources until an owner approves githq.
> **Checked 2026-10-12 (live, `gh` token with `repo`, `read:org`, `gist`, `workflow`):** `repo` does not
> reach Projects v2. `viewer { projectsV2 { nodes { id title } } }` → `INSUFFICIENT_SCOPES`: "The 'id' field
> requires one of the following scopes: ['read:project']". So `project` is a separate, necessary scope.

Rejected: GitHub App. Would win if users mostly worked inside orgs that install apps anyway and cared more
about least privilege than about a complete view. Could return later as an optional least-privilege mode.

### D4

The local copy has two parts. **About me**: issues and PRs anywhere on GitHub where the user is author,
assignee, requested reviewer or mentioned — refreshed through the search API; this feeds the dashboard.
**Tracked**: repositories and projects the user explicitly adds, mirrored in full (all issues and PRs, all
project items and fields) so they can be browsed and triaged; at first sign-in the user's own repos are
offered as tracked. Answers [Q4](#q4) (user, 2026-10-12). Why: works without knowing scale; covers a PR the
user opened in someone else's repo (not "their" repo, found only by search); avoids mirroring a 300-repo org
of which the user cares about five.
> **Checked 2026-10-12 (live, author's account):** `GET /issues?filter=all&state=all&per_page=100` — the first
> 100 results came from 20+ repositories, about 80 of them from one large public org the author is a member
> of but doesn't work in day to day. Meanwhile `search/issues?q=is:pr author:@me` returned the author's own
> PRs across 8 repos, none from that org. "Everything I can see" is dominated by org membership, not by
> the user's work — the case D4 is built for, on the first account we looked at.

> **Checked 2026-10-12 (live):** REST conditional request on `GET /issues?filter=all&state=all&since=…` with
> `If-None-Match` → `304`, `x-ratelimit-remaining` unchanged (4829 before and after). Polling this endpoint
> with ETags is free while nothing changes.

Rejected: mirror everything the user can see — expensive first sync and clutter for members of large orgs,
and still misses contributions to repos the user isn't a member of.

### D5

On the dashboard a PR's status means: CI checks, review state (approved / changes requested / review
required), draft, and whether it can be merged. Proposed by the agent, confirmed by user 2026-10-12.

### D6

Code review (diff, line comments) stays on github.com in the first version; githq opens the PR there with one
key. User, 2026-10-12: "review code zostanie na razie na githubie". The rest of the first-version boundaries
are still a proposal ([Q6](#q6)).

### D7

How the local copy learns about changes (agent's call, delegated by user 2026-10-12: "zrób research i
rozstrzygnij"). Polling only, in two independent loops:
- **Issues and PRs** in tracked repos: `GET /repos/{o}/{r}/issues?state=all&since=<last sync>` with
  `If-None-Match`; a 304 costs nothing. "About me" goes through search (two queries, issues and PRs).
- **Projects**: one conditional `GET` of each tracked project (`/users/{u}/projectsV2/{n}` or the org
  equivalent) per poll; 304 → nothing to do, free. On 200 the project changed — re-read its items, narrowed
  with `q=updated:>=<yesterday>` (date granularity only, so the window overlaps by a day).
Why: a project field edit is invisible to the issue feeds (live test below), so projects need their own
signal; the project's ETag / `updatedAt` is that signal and covers both field edits and edits to the issue
itself. Rejected: periodic full re-read of every project (≈30 points per 1,000 items per read, see Q2
arithmetic) and the Events API (30s–6h lag, no project events).
Untested: whether `updated:` in the items query matches an item whose only change is a field edit on an
issue last edited on an earlier day (could not separate within one day). If it doesn't, the narrowed re-read
misses such items and the fallback is a full re-read on every 200 — still bounded by how often the project
actually changes.

> **Checked 2026-10-12 (live, temporary issue in `kedrzu/githq` + temporary user-owned project, both
> deleted after):**
> - Adding an issue to a project and changing its Status did **not** change the issue's `updatedAt`
>   (stayed 15:45:14 while the item went 15:45:21 → 15:45:46). `GET /repos/…/issues?since=T0` and
>   `GET /issues?filter=all&since=T0` answered 304 / empty after the field edit; GraphQL
>   `issues(filterBy:{since:T0})` returned nothing.
> - `ProjectV2.updatedAt` and `ProjectV2Item.updatedAt` bumped on the field edit, and also on an edit of
>   the issue's title (issue 15:46:53, item and project 15:46:55).
> - REST `GET /users/kedrzu/projectsV2/1` and `…/items` return an ETag; unchanged → 304 with
>   `x-ratelimit-remaining` unchanged; after the field edit and after the title edit → 200.
> - `items(query:)` (GraphQL) and `q=` (REST) both accept `updated:>=2026-10-12` and `updated:@today`
>   (1 match) and `updated:<2026-10-12` (0). Full timestamps (`updated:>2026-10-12T15:45:30Z`) match
>   nothing in either direction — date granularity only. `status:"In Progress"` filters work too.
> - A GraphQL probe of one project's `updatedAt` costs 1 point.

### D8

Edit failures and conflicts are handled best effort in the first version: an edit shows at once; if GitHub
rejects it, the change is rolled back and an error is shown; if someone changed the same thing on github.com
meanwhile, the last write wins. No merge, no conflict UI. User, 2026-10-12: "na początek możemy rozwiązać je
w zasadzie w dowolny sposób". Revisit if real use shows lost edits.

## Open questions

### Q1

How does a browser-only app obtain a GitHub token? Answered by [D1](#d1). Premise under test: "no backend of our own".

> **Checked 2026-10-12:** the OAuth web-flow token endpoint is not usable from a browser. Docs:
> "CORS pre-flight requests (OPTIONS) are not supported at this time" —
> [Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).
> Empirically: OPTIONS on `https://github.com/login/oauth/access_token` → 404 HTML, and a real POST with an
> `Origin` header → 200 with no `Access-Control-*` headers, so `fetch` cannot read the token.

> **Checked 2026-10-12:** PKCE is supported (S256, OAuth Apps and GitHub Apps) but there is no public-client
> mode; `client_secret` is still required at code exchange. "GitHub is not requiring PKCE for any
> authentication flow at this time, as GitHub does not distinguish between public and confidential
> clients." — [changelog 2025-07-14](https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/).

> **Checked 2026-10-12:** device flow needs no secret ("The `client_secret` is not needed for the device
> flow." — [docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow))
> but `/login/device/code` and the polling endpoint return no CORS headers either (empirical POST and OPTIONS).
> Usable from a CLI, desktop shell or via a proxy; not from plain browser `fetch`.

> **Checked 2026-10-12:** `api.github.com` (REST and `/graphql`) is CORS-open: preflight → 204,
> `access-control-allow-origin: *`, allows `Authorization`, `If-None-Match`, `If-Modified-Since`; exposes
> `ETag`, `Link`, `X-RateLimit-*`. Empirical only, no docs statement found. Once a token exists, the browser
> can call the API directly.

> **Checked 2026-10-12:** fine-grained PATs cannot access user-owned Projects and are limited to one owner:
> "Each token is limited to access resources owned by a single user or organization." Both listed as gaps
> in [Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
> Org-owned projects have an `organization_projects` permission (GraphQL access not live-tested). The
> Projects API page names only classic PATs and GitHub App installation tokens. A classic PAT with the
> `project` scope covers user-owned and multi-org projects.

> **Checked 2026-10-12:** GitHub App user tokens (if expiring tokens are enabled) last 8h, refresh tokens 6
> months, rotated on use; refresh needs `client_secret` "unless the user access token was generated using
> the device flow" — [Refreshing user access tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens).

### Q2

How does the local cache learn about changes made on github.com, with no server to receive webhooks?
Answered by [D7](#d7).
Polling only. What follows is what polling has to work with.

> **Checked 2026-10-12:** primary limit 5,000/hour per user on REST (requests) and GraphQL (points).
> GraphQL cost = sum of requests implied by every connection at its `first`/`last` max, divided by 100,
> rounded, min 1. Secondary: 100 concurrent requests, 900 REST points/min, 2,000 GraphQL points/min, CPU-time
> caps; docs recommend serial requests —
> [GraphQL limits](https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api),
> [REST limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

> **Checked 2026-10-12:** a REST 304 to a conditional request costs no primary quota when sent with an
> `Authorization` header: "Making a conditional request does not count against your primary rate limit if
> a 304 response is returned…" — [REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).
> Changing page size, page or filter changes the ETag. No conditional mechanism found for GraphQL.

> **Checked 2026-10-12:** issues and PRs have a cheap "changed since" path. REST `GET /issues` and
> `GET /repos/{o}/{r}/issues` take `since` (last-updated) and include PRs (`pull_request` key); `GET /issues`
> with `filter=all&state=all` covers everything the user can see. GraphQL `issues(filterBy:{since})` exists;
> `pullRequests` has no `since` but orders by `UPDATED_AT` —
> [REST issues](https://docs.github.com/en/rest/issues/issues), [GraphQL issues](https://docs.github.com/en/graphql/reference/issues).

> **Checked 2026-10-12:** Projects v2 has no documented "changed since" primitive. `ProjectV2ItemOrderField`
> is `POSITION` only; `items(query:)` is a free-text filter. `ProjectV2.updatedAt`, `ProjectV2Item.updatedAt`
> and field-value `updatedAt` exist. A REST Projects API exists since 2025-09-11
> ([changelog](https://github.blog/changelog/2025-09-11-a-rest-api-for-github-projects-sub-issues-improvements-and-more/),
> [REST items](https://docs.github.com/en/rest/projects/items)): list items takes `q`, no `since`; ETag
> support not documented. Both open points (does `updated:` work via API; does a field edit bump the issue)
> were tested live on 2026-10-12 — results under [D7](#d7).

> **Checked 2026-10-12:** the Events API is too slow to be the change signal: "event latency can be anywhere
> from 30s to 6h" — [Events](https://docs.github.com/en/rest/activity/events). ETag + `X-Poll-Interval`,
> 304 is free. No Projects v2 event types exist.
> `GET /notifications` supports `If-Modified-Since` + `X-Poll-Interval`, 304 free —
> [Notifications](https://docs.github.com/en/rest/activity/notifications).
> Search: 30 req/min, 1,000-result cap, `updated:` at date granularity only —
> [Search](https://docs.github.com/en/rest/search/search).

> **Checked 2026-10-12:** issue types and sub-issues GA 2025-04-09
> ([changelog](https://github.blog/changelog/2025-04-09-evolving-github-issues-and-projects/)); dependencies
> (blocked by / blocking) GA 2025-08-21 ([changelog](https://github.blog/changelog/2025-08-21-dependencies-on-issues/)).
> All in GraphQL (`issueType`, `parent`, `subIssues`, `blockedBy`, `blocking`). Also seen, API coverage not
> checked: issue fields GA 2026-07-02, "Relates to" GA 2026-09-25.

#### Arithmetic: cost of re-reading one project

Inputs from the GraphQL cost rule above. One page = `items(first:100)` with, per item, `fieldValues(first:20)`,
`labels(first:10)`, `assignees(first:10)`: 1 + 100 + 100 + 100 = 301 requests → ≈3 points per 100 items.
A 1,000-item project ≈ 30 points per full read. Every 2 minutes → ≈900 points/hour, about 18% of the
5,000/hour budget, per project. The per-item connection sizes are guesses at a typical query, not measured.

### Q3

GitHub App or OAuth App? Answered by [D3](#d3). Evidence below.

> **Checked 2026-10-12:** a GitHub App user access token reaches only the intersection of the user's access
> and the app's installations: "a user access token can only access resources that both the user and app can
> access" — [Generating a user access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).
> Public repos are readable without installation ("implicit permissions to read public resources when acting
> on behalf of a user" — [Choosing permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app));
> writes outside installations are not possible by implication (no page says it outright; codex issues
> #37912/#21387 report `403 Resource not accessible by integration`).

> **Checked 2026-10-12:** GitHub App and Projects v2: org-owned projects work with the "Projects" org
> permission. User-owned projects via REST do not: "This endpoint does not work with GitHub App user access
> tokens…" — [REST projects](https://docs.github.com/en/rest/projects/projects). User-owned via GraphQL: not
> found in docs, untested.

> **Checked 2026-10-12:** notifications endpoints do not accept GitHub App user tokens — same "does not work
> with GitHub App user access tokens" line on [Notifications](https://docs.github.com/en/rest/activity/notifications).
> `GET /issues` does accept them ([Issues](https://docs.github.com/en/rest/issues/issues)); whether results
> are limited to installed repos: not found. Search with a user token must split `is:issue` / `is:pull-request`
> or it returns 422 — [Search](https://docs.github.com/en/rest/search/search).

> **Checked 2026-10-12:** OAuth App scopes: nothing narrower than `repo` allows issue/PR writes in private
> repos, and `repo` "Grants full access to public and private repositories including read and write access
> to code…" — [Scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).
> `project` covers user and org projects; `notifications` gives inbox read.

> **Checked 2026-10-12:** OAuth app access restrictions are "enabled by default" for new orgs; with them on,
> "API access to private organization resources is not available for unapproved OAuth apps" —
> [OAuth app access restrictions](https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions).
> GitHub Apps are not subject to those policies but need an install per org; members can request one —
> [Installing a third-party app](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party).

### Q4

What does the local cache mirror — everything the user can see, or a chosen set plus "involves me"? Answered by [D4](#d4).
User doesn't know typical scale (2026-10-12: "trudno powiedzieć"), so the answer must not depend on it.

### Q5

On the dashboard, is a PR that closes an issue (GitHub's `closingIssuesReferences`) its own row, or shown under
that issue? Open — user (2026-10-12) wants to decide after seeing UI designs. Agent's recommendation: separate
rows, with the issue row carrying a small marker of the linked PR and its status. Trade-off: separate rows are
faithful but show the same work twice; nesting is quieter but the issue row must carry PR status, and a PR
closing three issues appears three times.

### Q6

Boundaries of the first version. Proposed by agent 2026-10-12; code review settled by [D6](#d6), failures and
conflicts by [D8](#d8). User did not object to the rest and moved on to UI (2026-10-12); written into README
as the first version. Still open, left to UI designs: board view for projects (and Q5). In: sign-in and
choosing tracked repos; "about me" dashboard (assigned issues, my PRs with status, review requests); issue/PR
detail with comments and edits (assignees, labels, open/close, comment); tracked-project view as a list with
the project's own fields editable in place; command palette and full keyboard navigation. Out: code review
(diff, line comments) — one key opens the PR on github.com; creating PRs; notifications inbox; project board
view if the list is enough to start.
