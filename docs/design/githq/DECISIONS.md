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

githq registers as a GitHub **OAuth App**, requesting `repo`, `project` and `read:org` scopes (more only when a
feature needs one; `read:org` added by [D14](#d14)). Answers [Q3](#q3) (user, 2026-10-12). Why: the dashboard needs the user's whole footprint —
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

### D9

UI direction: "Direction D — Synthesis" in `design.pen` (frame `I7akNj`), chosen by user 2026-10-12. One app
with three independent switches: sidebar expanded or collapsed to a rail; every list (my work, a project, a
repository) shown as List or Board with the same toolbar; an item opened in a panel, modal or full page, all
rendering the same item view. As drawn, it settles two questions left to the visuals, pending the user's
objection: a PR that closes an assigned issue is shown nested under that issue in "my work" (closes
[Q5](#q5)), and projects get a Board in the first version ([Q6](#q6)).

> **Checked 2026-10-12 (live GraphQL introspection):** GitHub's saved project views are readable —
> `ProjectV2View` has `name`, `layout`, `filter: String`, `groupByFields`, `verticalGroupByFields`,
> `sortByFields`, `fields`; mutations `createProjectV2View`, `updateProjectV2View`, `deleteProjectV2View`
> exist. The filter is GitHub's project query string, so showing a saved view instantly from the local copy
> means evaluating that query language locally.
> Field values (e.g. `ProjectV2ItemFieldSingleSelectValue`) carry `creator: Actor` and `updatedAt`;
> `ProjectV2Item` has `isArchived`. Whether `creator` is the last person to set the value (needed for
> "moved by olam") is untested.

### D10

First-version additions and exclusions after the Direction D review. Agent's recommendations, adopted when the
user asked to apply all corrections (2026-10-12):
- **Creating an issue is in the first version** (repo, title, body, assignees, labels, milestone, type,
  projects and their fields, parent). Was missing from the agent's first-version list.
  > **Checked 2026-10-12 (live):** GraphQL `Repository.issueTemplates` returns markdown templates only
  > (`IssueTemplate`: about, assignees, body, filename, labels, name, title, type). Issue **forms** (YAML) are
  > not included: `vitejs/vite` has `bug_report.yml`, `feature_request.yml`, `docs.yml` in
  > `.github/ISSUE_TEMPLATE/` and `issueTemplates` returns `[]`. Forms must be read through the contents
  > API and parsed by githq; the first version may render a form as a pre-filled markdown body.
- **Merging a PR is not**: like code review ([D6](#d6)), it happens on github.com. githq shows mergeability.
- **No actor on project field changes** ("moved by olam") until it's verified that the field value's
  `creator` is the last person to set it ([D9](#d9) evidence). Show when it changed, not who.

### D11

What "my work" contains (agent's proposal, adopted 2026-10-12). Open issues and PRs from anywhere on GitHub in
four groups, each item **once**, in the first group that applies: review requested from me → my open PRs →
assigned to me → mentioning me. A PR of mine that closes an issue in "assigned to me" appears nested under that
issue and nowhere else. Counts are of top-level rows; sidebar counts equal the list's group counts and the
total is their sum.
Filters on top: **Needs me** = review requested from me + my PRs with failing checks, changes requested or
conflicts + issues assigned to me; **Waiting on others** = my PRs waiting for review or with checks running;
**All**. These are views computed from GitHub data, not stored anywhere — no conflict with [D2](#d2).

### D12

Which project field appears in a row outside the project (e.g. in "my work"). Agent's proposal, adopted
2026-10-12. Each project has one **row field**: by default its single-select field named "Status", otherwise
its first single-select field, otherwise none; the user can change it per project. An item in several projects
shows the row field of the first of them in the user's sidebar order, plus "+N" for the others; the item
view shows all of them.

### D13

Saved project views shown as tabs are GitHub's own views (`ProjectV2View`, see [D9](#d9) evidence). githq
evaluates their filter locally, so they stay instant; a filter githq can't evaluate yet falls back to asking
GitHub and says so. Changing grouping, sorting or layout in githq is local to the device and marks the view
as locally modified with a reset; githq does not write views back to GitHub in the first version
(`updateProjectV2View` exists; rejected for now — editing a shared view would change it for the whole team).
Archived project items (`isArchived`) are hidden.

### D14

Second design round (Direction D, `design.pen` frame `I7akNj`, reviewed 2026-10-12) covers every screen the
round-2 prompt asked for: PR view (F1–F4), first sign-in, tracking and account (G1–G10), creating an issue
(H1–H9), repository (J1–J3), states (K1–K9); fixes in D1/D2/D4 applied (counts 2+3+5+3=13 with a Mentioned
group, "In progress +1", no "moved by", locally modified view with reset, "Open on GitHub" instead of merge).
Consequences the agent drew from it — agent's analysis, confirmed by user 2026-10-30:
- **`read:org` joins `repo` and `project`** ([D3](#d3)): listing the user's organisations (owner filter in
  G2/G4, "member of 3 organisations" in G9, detecting the org that hides private data in G5) needs it.
- **Edits are gated by the user's permission on the repository** (`viewerPermission`), as E4 already does
  ("2 of 3 editable"), instead of failing after the fact. K1's example (adding a label in vitejs/vite as a
  contributor) should not be offered at all; K1 stays for failures githq can't predict.
- **Writes are checked against what GitHub returns**: for users without push access GitHub silently drops
  labels, assignees, milestone and type on issue creation, so a missing value in the response is a rejection.
- **Issue forms in repositories where the user can't push are handed off to GitHub's own form**, opened with
  the title (and form fields) pre-filled through URL query parameters. Reason: githq can't apply the form's
  labels for such users (silently dropped) and GitHub does not validate form fields on API creation, so H8's
  "its default labels already set" and "GitHub checks them again" are not true for outside contributors.
  H8's pre-filled body remains for repositories where the user has push access.
- **"1 of 2 approvals"** (F1, F3): the PR exposes `reviewDecision` and the reviews, not the required count;
  that lives in branch protection or rulesets, which may not be readable without admin rights. Show approvals
  without "of N" unless the required count is known.
- **Organisation owner names and approval-request status** (G5, G8, G9: "ewa-k or mbrandt", "requested 2 days
  ago, waiting") are not known to be available through the API for a restricted org — unverified. Until
  verified: show that the org hides data, link to GitHub's page for requesting approval, and remember locally
  when the user clicked it.

> **Checked 2026-10-12:** REST "Create an issue": "NOTE: Only users with push access can set labels for new
> issues. Labels are silently dropped otherwise." Same wording for milestone, assignees, type and field
> values — [Issues](https://docs.github.com/en/rest/issues/issues).

> **Checked 2026-10-12:** `GET /user/orgs` "requires at least user or read:org scope for OAuth app tokens and
> personal access tokens (classic). Requests with insufficient scope will receive a 403 Forbidden response." —
> [Organizations](https://docs.github.com/en/rest/orgs/orgs).

> **Checked 2026-10-12:** new-issue URLs accept `template=` and, for issue forms, values for the form's
> fields: "You can also use URL query parameters to fill custom text fields that you have defined in issue
> form templates." Using a parameter for an action (e.g. `labels`) requires permission for that action —
> [Creating an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue).

> **Checked 2026-10-12 (live GraphQL introspection):** `PullRequest` has `reviewDecision`
> (`CHANGES_REQUESTED | APPROVED | REVIEW_REQUIRED`), `mergeStateStatus` (`DIRTY | UNKNOWN | BLOCKED | BEHIND |
> UNSTABLE | HAS_HOOKS | CLEAN`), `mergeable`, `statusCheckRollup`, `latestOpinionatedReviews`,
> `reviewRequests`, `isInMergeQueue`, `autoMergeRequest`; no field for the number of required approvals.

### D15

Every large surface shows how fresh what it displays is: a whole list (my work, a project view, a repository),
and an opened item — not each row. User requirement, 2026-10-30 ("potrzebujemy wiedzieć, czy wersja jest
aktualna"). What a surface can be, from the sync model ([D7](#d7)):
- **fresh**: the poll covering this surface succeeded within its interval (~30 s);
- **checking** right now;
- **stale**: last successful check is older than expected — offline, a failing request, or refresh paused by
  the API allowance (K3);
- **partial**: still downloading (first download, newly tracked repository);
- **answered by GitHub**: a saved view githq can't evaluate locally (K6), refreshed more slowly;
- **own edits on the way**: the user's changes are shown but not yet confirmed by GitHub; or one failed.
An opened item may also have parts fetched separately (see [Q8](#q8)), so its freshness can differ from its
list's. Visual form: three directions requested from the design agent; user picks.

### D16

Stack and setup replicate the author's Cookery app (`~/Dev/cook-app`): bun workspaces + Nx, the author's
framework nzyme as a git submodule (`workspace:*` deps), Nuxt 4 with `ssr: false` built statically, no
auto-imports, routes declared in `router.options.ts`, state in nzyme IoC services (`defineService` with
`shallowRef`/`computed`), `@nzyme/i18n` with `.loc.yaml`, reka-ui, oxlint/oxfmt, `bun test` + Vitest browser +
Storybook + Playwright e2e, `setup.sh`/`setup.build.sh`, `paseo.json`, `.claude/skills/nzyme` symlink. One
Cloudflare Worker serves the static SPA (`not_found_handling: single-page-application`) and runs first only for
the OAuth token exchange ([D1](#d1)). User, 2026-10-30. Dropped from Cookery: Supabase, database/backend/mcp
packages, RLS, Realtime, RPC commands.

> **Checked 2026-10-30 (codebase survey of `~/Dev/cook-app` and `~/Dev/nzyme`):** layout `packages/{app,api,
> backend,core,database,mcp,e2e}`, nzyme submodule via `.gitmodules`; `packages/api/wrangler.jsonc` serves
> assets with `run_worker_first` for `/api/*` etc.; app state via `@nzyme/vue-ioc`
> (`packages/app/auth/AuthStore.ts`, `plugins/iocPlugin.ts`); architecture rules in
> `docs/design/architektura/DECISIONS.md` (D2, D13–D14, D18, D21 no CI, D28 static SPA + Worker).
> nzyme has **no** IndexedDB, local-first, query/cache or GraphQL layer, and no Cloudflare package; it has
> `@nzyme/fetch-utils` (typed `defineEndpoint`/`defineFetchClient`) and `@nzyme/openapi`.

### D17

The local working set lives in memory; IndexedDB is persistence only. At start githq loads issues, PRs and
project items (without bodies, comments, check lists and reviews) from IndexedDB into reactive in-memory maps;
every list, filter, count, grouping and saved-view evaluation is computed from memory; sync results are applied
to memory and written behind to IndexedDB. Answers [Q9](#q9) (user, 2026-10-30). Why: navigation in single
milliseconds, and saved-view filters must be evaluated in code anyway ([D13](#d13)), which IndexedDB indexes
can't express. Rejected: querying IndexedDB per view (e.g. Dexie live queries) — every navigation becomes a
database read. Would win if a user tracked repositories with tens of thousands of items and loading them at
start became noticeable; the fallback then is to keep closed items out of memory and fetch them on demand.

### D18

What the copy holds per item. Always: list data and fields, and a PR's status summary (check rollup, review
decision, mergeability) — what rows need. Fetched when an item is opened, then kept: body, comments, the full
check list, reviews. Prefetched for everything in "my work", so the "comments still loading" state appears only
for items outside the user's work opened for the first time. Answers [Q8](#q8) (user, 2026-10-30).

### D19

GitHub GraphQL client follows the pattern of the author's `healedcare/healed` repo (`packages/healthie`):
graphql-codegen with `typescript`, `typescript-operations` and `typescript-generic-sdk` (`documentMode:
'string'`), one `.gql` file per operation under `src/operations/`, a committed SDL schema file, a committed
`generated.gen.ts`, and a small hand-written requester that the generated SDK calls. Answers the typing part of
[Q11](#q11) (user, 2026-10-30). REST with ETags stays for change detection ([D7](#d7)) and goes through
`@nzyme/fetch-utils`.

> **Checked 2026-10-30 (codebase, `~/Dev/sigma`, remote `healedcare/healed`):** `packages/healthie/codegen.yml`
> — `schema: 'src/schema.graphql'`, `documents: 'src/operations/**/*.gql'`, plugins `add` (TypedDocumentString
> header), `typescript`, `typescript-operations`, `typescript-generic-sdk`, `documentMode: 'string'`, hook
> `oxfmt`; `src/createHealthieRequester.ts` posts `{query: String(doc), variables}` with `fetch`, throws on HTTP
> error and on a non-empty `errors` array; `scripts/fetchSchema.ts` introspects and writes SDL; scripts
> `schema`, `codegen`; `generated.gen.ts` is committed.

> **Checked 2026-10-30:** GitHub publishes its GraphQL schema as SDL at
> `https://docs.github.com/public/fpt/schema.docs.graphql` (HTTP 200, ~75k lines, last-modified 2026-10-30) —
> usable as the schema source without introspection.

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

Closed by [D9](#d9) (nested, as drawn). Original question: on the dashboard, is a PR that closes an issue (GitHub's `closingIssuesReferences`) its own row, or shown under
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

### Q7

Mostly answered by [D10](#d10)–[D13](#d13); missing screens handed to the design agent (prompt in
`ui/design-agent-prompt.md`). Original: review of Direction D against the UI brief (2026-10-12). Gaps and inconsistencies raised with the user:
- Not drawn: the whole first-sign-in path (tracking choice, first download, org that hides private repos);
  PR item view (checks, reviewers, branches, mergeability, hand-off to github.com for review); creating an
  issue; repository view; "track repositories" / settings / account; states (edit rejected, refresh paused,
  empty "my work").
- Scope gap from the agent's own first-version list: creating a new issue was never in it.
- Is merging a PR from githq in scope? The design shows "Approved · ready to merge" but no merge action.
- Counts disagree (sidebar "My work 11", "My pull requests 4", "Mentioned 3" vs the list's groups 2/3/5 and
  no Mentioned group): needs a rule for what "my work" contains and whether a nested PR counts.
- An issue in two projects (Platform Q4: In progress; Bug triage: Confirmed) shows one status in the "my
  work" row: needs a rule for which project's field a cross-project list shows.
- "Needs me / Waiting on others" is githq's own classification: must be defined from GitHub data.
- Saved views as tabs ("from GitHub") imply a local evaluator for GitHub's project filter language.

### Q8

Answered by [D18](#d18). Original: what the local copy holds per item, beyond the list data. The designs assume tracked repositories are copied
including closed items (G6: "Closed issues arrive last"), and the item view shows comments, checks and reviews
at once. Open: are comments, the PR check list and reviews part of the copy for every item, or fetched when an
item is opened (and prefetched for "my work")? Decides IndexedDB size, first-download cost, and whether the item
view needs a "comments still loading" state. To settle with the local data model.

### Q9

Answered by [D17](#d17). Original: local store: nzyme has none. Agent's proposal: the working set (issues, PRs, project items without bodies and
comments) lives in memory as reactive maps and every list is computed from memory; IndexedDB is only the
persistence underneath, loaded at start and written behind. Alternative: query IndexedDB per view (e.g. Dexie
live queries). Open, raised with user 2026-10-30.

### Q10

Several tabs open at once would each run the sync loop and multiply API use. Agent's proposal: one tab holds a
Web Lock and syncs, others receive changes over BroadcastChannel. Proposed to user 2026-10-30, not objected to; treated as the
default for the first version unless they say otherwise.

### Q11

Typing answered by [D19](#d19). Original: GitHub client shape: REST with ETags for change detection (free 304s, [D7](#d7)), GraphQL for bulk reads and
writes (one request for an item with its project fields). How GraphQL queries are typed (codegen vs. a typed
document library) — not chosen. Open.
