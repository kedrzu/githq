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
parent/sub-issues, dependencies. Source: user, 2026-10-12 ("we are not trying to impose some convention of
our own here"). Rejected: label conventions for status/priority (a second source of truth github.com doesn't
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

A third kind of local data, "browsed", joined these two on 2026-11-04: a repository the user only looks at, read on
demand and never in the background. See [D34](#d34).

### D5

On the dashboard a PR's status means: CI checks, review state (approved / changes requested / review
required), draft, and whether it can be merged. Proposed by the agent, confirmed by user 2026-10-12.

### D6

Code review (diff, line comments) stays on github.com in the first version; githq opens the PR there with one
key. User, 2026-10-12: "review code zostanie na razie na githubie". The rest of the first-version boundaries
are still a proposal ([Q6](#q6)).
Superseded 2026-11-02 by the owner: review comes to githq, see [the code review design](../code-review/README.md).

### D7

How the local copy learns about changes (agent's call, delegated by user 2026-10-12: "do the research and
decide"). Polling only, in two independent loops:

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
>
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

> **Checked 2026-10-30 (live, `gh` token):** REST `GET /search/issues?q=is:open is:pr author:@me&sort=updated`
> returns **no `ETag`**, so "about me" cannot use free 304s. It draws on the separate `search` bucket (30/min,
> `x-ratelimit-resource: search`), not the 5,000/hour core or GraphQL budget. Four "my work" queries every
> 30 s are 8/min; only items whose `updated_at` moved are then re-read through GraphQL.

### D8

Edit failures and conflicts are handled best effort in the first version: an edit shows at once; if GitHub
rejects it, the change is rolled back and an error is shown; if someone changed the same thing on github.com
meanwhile, the last write wins. No merge, no conflict UI. User, 2026-10-12: "for a start we can resolve them
in basically any way". Revisit if real use shows lost edits.

### D9

UI direction: Direction D in `githq.pen` (overview frame `I7akNj`, screens in the `App · …` frames), chosen by user 2026-10-12. One app
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
> "moved by sofiab") is untested.

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
- **Merging a PR was not**: like code review ([D6](#d6)), it was to happen on github.com. Superseded 2026-11-01 by the
  owner: githq merges, see [the merging design](../pr-merge/DECISIONS.md#d1).
- **No actor on project field changes** ("moved by sofiab") until it's verified that the field value's
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

Second design round (Direction D, `githq.pen` frame `I7akNj`, reviewed 2026-10-12) covers every screen the
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
and an opened item — not each row. User requirement, 2026-10-30 ("we need to know whether the version is
current"). What a surface can be, from the sync model ([D7](#d7)):

- **fresh**: the poll covering this surface succeeded within its interval (~30 s);
- **checking** right now;
- **stale**: last successful check is older than expected — offline, a failing request, or refresh paused by
  the API allowance (K3);
- **partial**: still downloading (first download, newly tracked repository);
- **answered by GitHub**: a saved view githq can't evaluate locally (K6), refreshed more slowly;
- **own edits on the way**: the user's changes are shown but not yet confirmed by GitHub; or one failed.
  An opened item may also have parts fetched separately (see [Q8](#q8)), so its freshness can differ from its
  list's. Visual form: a status bar along the bottom of the window, one segment per surface (sidebar, list,
  item), dim when fresh and coloured when not — chosen in `githq.pen` (frame "App · Freshness").

### D16

Stack and setup: bun workspaces + Nx, the author's
framework nzyme as a git submodule (`workspace:*` deps), Nuxt 4 with `ssr: false` built statically, no
auto-imports, routes declared in `router.options.ts`, state in nzyme IoC services (`defineService` with
`shallowRef`/`computed`), `@nzyme/i18n` with `.loc.yaml`, reka-ui, oxlint/oxfmt, `bun test` + Vitest browser +
Storybook + Playwright e2e, `setup.sh`/`setup.build.sh`, `paseo.json`, `.claude/skills/nzyme` symlink. One
Cloudflare Worker serves the static SPA (`not_found_handling: single-page-application`) and runs first only for
the OAuth token exchange ([D1](#d1)). No database, no backend of our own. User, 2026-10-30.

> **Checked 2026-10-30 (codebase survey of nzyme):** nzyme has **no** IndexedDB, local-first, query/cache or GraphQL layer, and no Cloudflare package; it has
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

GitHub GraphQL client: graphql-codegen with `typescript`, `typescript-operations` and `typescript-generic-sdk` (`documentMode:
'string'`), one `.gql` file per operation under `src/operations/`, a committed SDL schema file, a committed
`generated.gen.ts`, and a small hand-written requester that the generated SDK calls. Answers the typing part of
[Q11](#q11) (user, 2026-10-30). REST with ETags stays for change detection ([D7](#d7)) and goes through
`@nzyme/fetch-utils`.

> **Checked 2026-10-30:** GitHub publishes its GraphQL schema as SDL at
> `https://docs.github.com/public/fpt/schema.docs.graphql` (HTTP 200, ~75k lines, last-modified 2026-10-30) —
> usable as the schema source without introspection.

### D20

Variants picked among the round-2 screens drawn side by side (user, 2026-10-30, at the start of the build):
**G1b** — the screen before signing in explains up front what GitHub's consent screen will ask for;
**G2** — choosing what to track is a deliberate step after the first sign-in (own repositories pre-selected);
**G6** — the first download is a progress step that can be left as soon as "my work" is in;
**H1** — creating an issue starts as a quick capture (repository, title, optional chips), which expands into
the full form (H3). Rejected: G1a (permission explained only on demand), G3 (no tracking step, suggestions
later), G7 (straight into the app while downloading), H4 (one full form).
The G1b part is superseded by [D21](#d21).
The G6 part is superseded by [first-run-and-loading D1](../first-run-and-loading/DECISIONS.md#d1): the first
sign-in has no download step.

### D21

There is no sign-in screen of our own on the web: "Sign in with GitHub" on the landing page (githq.dev) goes
straight to GitHub's consent screen. Supersedes G1b in [D20](#d20) (user, 2026-10-31: the landing page now
says what githq is, so a screen between it and GitHub only adds a click). What G1b explained moves:

- one line under each "Sign in with GitHub" on the landing page warns that GitHub will ask for full
  repository access and that githq only touches issues, pull requests and the code they change, projects and, if you ask, its own settings repository
  ([settings-sync D6](../settings-sync/DECISIONS.md#d6)), linking to a "Why?"
  that lives on the Privacy page (scopes, why nothing narrower exists, where the data goes);
- coming back from GitHub with the sign-in cancelled or failed lands on the landing page with a one-line,
  dismissible banner and "Try again" (screen G1, formerly G1c);
- a visitor who already holds a token goes from githq.dev straight into the app.

The desktop app keeps its own screen before signing in (S1): it has no landing page in front of the Device
Flow.

### D22

"My work" can also be grouped by **repository** (user, 2026-10-31), next to the default grouping by reason
([D11](#d11)). The groups are the tracked repositories in the sidebar's order, each holding the items of
that repository; a row then drops the repository from its reference (`#482`, not `fitloop/api#482`). Items
from repositories the user doesn't track (a PR of theirs in an open-source project, a mention elsewhere)
fall into one last group, **Other repositories**, marked "not tracked", whose rows keep the full
`owner/repo#number`. Inside a group the rows keep the reason order (review requested → my PRs → assigned →
mentioned); the row's status line still says why the item is there. The nesting rule and the counts of
[D11](#d11) hold: a PR that closes an assigned issue stays nested under it, and the group counts sum to the
"My work" total. The sidebar's per-reason counts don't change with the grouping. Screen D6.

### D23

githq also ships as a Tauri v2 desktop app for macOS (Apple Silicon and Intel), Windows (x64) and Linux (x64),
which bundles the built SPA locally and updates itself from GitHub Releases with signed updates. User,
2026-10-31 (issue #31; spec and plan `.context/specs|plans/2026-10-31-desktop-app.md`). Why: a token with `repo`
scope deserves code that ships inside a signed bundle, a token obtained straight from GitHub and kept in the OS
keychain, and an app that talks to nothing but GitHub. That is a stronger trust story than a web page whose code
is whatever githq.dev serves today and whose sign-in passes through our Worker ([D1](#d1)).
Rejected: a thin webview loading githq.dev. Updates would come for free, but it cannot start offline, the code it
runs is whatever githq.dev serves at that moment, and native APIs would be exposed to a remote origin. That is
the installable PWA with extra steps. Would win if releasing the shell became a real burden.

- **Sign-in:** GitHub's OAuth Device Flow, with the same OAuth App as the web ([D3](#d3)) and Device Flow enabled
  on it. The app needs no client secret and our Worker plays no part. The public client ID is compiled in
  (`GITHQ_GITHUB_CLIENT_ID`). The scopes are the same `repo project read:org`. A token granted with fewer scopes
  is refused and never stored. The token lives in the OS credential store (Keychain, Credential Manager, Secret
  Service). Without a working store it lives in memory for that run and the screen says so up front. It is never
  written to a file or to web storage. Rejected: the web flow through the Worker with a deep link back into the
  app (the token passes through our server); a loopback web flow (needs the client secret embedded in the app);
  reusing `gh auth token` (gh's default token lacks `project` and carries broader scopes such as `gist` and
  `workflow`).
- **Its own screen before signing in (S1).** The desktop app has no landing page in front of the Device Flow
  ([D21](#d21)), so S1 stands on its own rather than reusing a web screen, which no longer exists: its explanation,
  layout and copy live in `desktop/DesktopSignIn.vue`. The desktop build prerenders nothing, so `/` in its window is
  `index.html`, the app shell, and signed out home shows S1 at `/`, with `/login` and every other address of the
  app leading there as on the web.
- **Architecture "A — minimal interface"** (owner, at planning). The SPA builds for a third target,
  `GITHQ_TARGET=desktop` (define `__DESKTOP__`, output `.output-desktop`), and the web builds drop the desktop
  code entirely (`checkProductionBuild.ts` asserts it). All desktop code lives in `packages/app/desktop/` and comes
  in through one gate, `installDesktop` from `plugins/iocPlugin.ts`, plus five `__DESKTOP__` choices (the signed-out
  home page, the status bar's update segment, the organisation-approval URL, the GitHub hand-off page and the macOS
  window controls). The native
  bridge (`desktop/NativeBridge.ts`) talks to `window.__TAURI_INTERNALS__` directly, with no `@tauri-apps/*`
  packages in the SPA. The Device Flow, the keychain, opening links and the updater are Rust commands in
  `packages/desktop/src-tauri`. The token reaches `AuthStore` through a `TokenVault` seam: `localStorage` on the
  web, as before, and the native store on desktop. Rejected: a flexible "host contributions" design, where the
  shell registers services and UI into the app (more surface than four choices need); and a shim shaped like
  `Storage` for the token (it would hide that the desktop store is asynchronous and may be unavailable).
- **macOS window controls over the sidebar.** On a Mac the window has no title bar of its own: the controls sit in a
  36px strip along the top of the sidebar, and the rail is 80px there, not 56px, to hold them (owner, 2026-11-01).
  With no title bar the page says what moves the window (`shell/windowControls.ts`): that strip, each screen's top
  header except what is clickable in it, and the same on the two screens with no sidebar. Windows and Linux keep their
  title bars. In full screen, where macOS hides the controls, the strip goes, the rail is 56px and the first sign-in's name moves back to the edge (owner, 2026-11-05): the
  window's resize events say when to ask, `desktop/DesktopWindowControls.ts`. Zoomed, the window keeps both, as the
  controls stay. Accepted: an unfocused window only activates on the first press, as Tauri documents for this style.
  Rejected: `accept_first_mouse`, which would drag at once but also send that first press to every control in the app;
  a 56px rail, with the controls spilling over the screen's header.
- **The window stays on the app.** Every address outside the app opens in the system browser: the page
  intercepts links and the `Browser` service, and the window's `on_navigation`/`on_new_window` handlers back it
  up. The content security policy allows `connect-src` only to `api.github.com` and to githq.dev, whose Worker
  revokes the token on signing out (it alone holds the OAuth App's secret), and images only from GitHub's hosts.
- **Links open in the app** (owner, 2026-11-06). The app registers `githq://`, where `githq://<path>` is the app's
  `/<path>`, and runs as a single instance. A signed macOS build also takes `https://githq.dev/...` as a Universal Link,
  and a githq.dev link inside the window stays in it. Every other browser hands off through an opt-in on the web.
  Why: [the decision](../../decisions/desktop-deep-links-and-web-hand-off.md).
- **Updates:** the app checks GitHub Releases at launch and every 4 hours and downloads in the background. The
  signature is always verified. The update is then offered as "githq X.Y.Z is ready · Restart · Later" at the
  right end of the status bar (`githq.pen`, "Desktop · Updates", U1). Nothing restarts on its own. On macOS
  and Linux the download is installed at once and runs from the next launch. On Windows the installer runs on
  Restart.
- **Releases:** a manually dispatched action, `.github/workflows/release.yml`, with a mode: `preview` prints the
  next version and notes and releases nothing; `candidate` and `stable` tag `main`, create a draft release with the
  generated notes, and build on GitHub-hosted runners for all three OSes (the repository is public, so they are
  free). The owner publishes the draft by hand. The version and the notes come from the Conventional Commit titles
  of the PRs since the last stable tag, by a small tested script, `packages/app/scripts/releasePlan.ts`: `feat`
  bumps minor, `fix` and `perf` patch, `!` is breaking (minor while 0.x), and a `web` or `cloud` scope keeps a change
  out of the desktop version and notes. A tag `-rc.N` (`v0.2.0-rc.1`) becomes a prerelease. GitHub never makes a
  prerelease "latest", and the updater reads `releases/latest/download/latest.json`, so prereleases never reach
  installed apps. Windows ships as an NSIS installer only: WiX takes no version with a non-numeric prerelease part.
  Owner, 2026-11-01: on demand, the changelog lives in GitHub Releases with no `CHANGELOG.md`, and the scopes are
  `web` and `cloud`. Rejected: release-please (a bot PR rewritten on every push, version commits on `main` that
  also deploy the web, and it needs PR rights for Actions and a separate token, because tags made with the default
  token start no workflow); git-cliff (no documented `-rc.N` numbering, and the desktop-only exclusions would still
  need our own logic); a schedule (undecided drafts and tags would pile up, and a release is a decision). Not yet
  possible: forcing a version, so 1.0.0 needs a small PR adding an input to the action. How-to:
  `docs/desktop/RELEASING.md`.
- **Signing:** macOS with the owner's Developer ID, bought by the owner; until then ad-hoc (`signingIdentity: "-"`), so
  Apple Silicon says "unidentified developer" rather than "damaged". Windows through SignPath Foundation (free
  code signing for open source), in a follow-up once the project is accepted; until then unsigned. Rejected:
  Azure Artifact Signing (individuals only in the USA and Canada, see below); an OV certificate ($150–300 a year,
  and SmartScreen reputation still builds slowly). Either would win if SignPath turned the project down.
  SignPath requires a license "without commercial dual-licensing": githq is AGPL-only and no commercial license
  is offered (user, 2026-11-01). The CLA keeps the maintainer's right to offer other terms, unused; offering a
  commercial license later would break this condition and need another way to sign Windows builds.

> **Checked 2026-10-12:** the Device Flow needs no client secret, and its endpoints answer no CORS, so it runs
> from the native side, not the webview. Evidence under [Q1](#q1).

> **Checked 2026-10-31 (live, Task 1 of the plan, macOS):** the built desktop app opened a deep path directly,
> so Tauri v2 serves `index.html` for unknown asset paths (the fallback added in tauri commit 8a7921e, 2021), and
> web-history routing works without hash routes. A GraphQL call to `api.github.com` from the app's origin
> (`tauri://localhost`) succeeded: `access-control-allow-origin: *` covers it, as it covers githq.dev
> ([Q1](#q1)). E2E (`packages/e2e/src/desktop/`) keeps the deep-path case covered against a static server with
> the same fallback.

> **Checked 2026-10-31:** `WebviewWindowBuilder::on_new_window` does not fire for `target="_blank"` anchor clicks
> on Windows/WebView2 ([tauri-apps/tauri#15872](https://github.com/tauri-apps/tauri/issues/15872), open). So the
> page catches external links itself, and `on_new_window`/`on_navigation` are only backstops.

> **Checked 2026-10-31:** an empty `APPLE_CERTIFICATE` in the environment counts as present and fails the bundle:
> "failed to import keychain certificate Ok("")"
> ([tauri-apps/tauri-action#234](https://github.com/tauri-apps/tauri-action/issues/234)). So the release workflow
> exports the Apple variables only when the secrets are set.

> **Checked 2026-10-31:** Azure Artifact Signing (formerly Trusted Signing), ~$9.99/month: "Individual developers
> are currently limited to the USA and Canada". OV certificates: $150–300/year
> ([Microsoft Learn, Code signing options for Windows app developers](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)).
> The owner publishes as an individual from outside both countries.

> **Checked 2026-10-31:** unsigned Windows apps get a SmartScreen warning when downloaded, and "Windows 11 with
> Smart App Control turned on … blocks unknown unsigned apps even if they weren't downloaded from the browser, and
> users can't allow a single app, only turn Smart App Control off entirely"
> ([Tauri, Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)).

> **Checked 2026-10-31 ([signpath.org/terms](https://signpath.org/terms.html)):** the conditions for a free SignPath
> Foundation certificate include: an OSI-approved license "without commercial dual-licensing for all components",
> and no proprietary components; the project "must already be released in the form that should be signed";
> binaries "built from source code in a verifiable way" (in practice, on GitHub-hosted runners from the
> repository); "every release needs manual approval for signing"; MFA for every team member on SignPath and on
> GitHub; and a "Code signing policy" on the home page and the download page. That policy names the team roles
> (Authors, Reviewers, Approvers), carries a privacy statement and, once signing is active, the line "Free code
> signing provided by SignPath.io, certificate by SignPath Foundation". Software that installs must also explain
> how to uninstall it. The policy is in the root `README.md`.

### D24

Settings chooses what to track with **the first sign-in chooser itself** (owner, 2026-11-02, "Direction A" of
three). The section "What to track" replaces the separate Repositories and Projects sections and is the
`Track / Choose what to track` component of G2: owners on the left listing every repository, the search and sort
right above the list, repositories ticked and grouped by owner, projects beside them. A tick means tracked. In
settings a tracked row shows its sync status where sign-in shows activity, and changing ticks stages changes that
a bar at the bottom saves or discards together, so many repositories are tracked or untracked at once. Why: the
two screens were built differently for the same question, the old one could only find repositories by search,
and its single-key shortcuts acted on rows that couldn't be selected. Rejected: ticks as a selection with
Track/Untrack bulk actions ("B", faster for big changes but a second model next to sign-in's), and tracked and
available as two side-by-side lists ("C"). The section "Saving to GitHub" is renamed **Sync settings**; settings
has three sections, keys 1 to 3. Screens G8 and T1 in `githq.pen`.

Settled while building it (PR #82, 2026-11-02):

- **Saving is one write of the staged changes onto what is tracked by then**, not the ticks as they stand: a
  repository tracked meanwhile in another tab, or a tracked row the list never drew, is never untracked by Save.
- **Staged changes live as long as the section is shown.** Switching to another section or leaving Settings drops
  them without asking (owner's call; keeping them across sections would need state above the section).
- **A group's action** reads "Untrack all" only when every row it covers is ticked, else "Track all", the rule
  sign-in already has for "Select none" / "Select all".
- **What the lists don't hold still shows**, so it can be unticked: someone else's tracked repository in a group
  "Elsewhere" at the end, and while the lists are first read (or reading them failed) the tracked rows alone,
  under "Reading your repositories…".
- **A tracked row's middle column is its open count**, as for every other row; githq can't tell how much one
  repository takes in the browser, so T1's "1,420 · 21 MB" became "142 open".
- **Dropped with the old screen:** the repositories suggested from My work, the size this browser keeps (Account
  still shows it), the owner menu, the Organisations panel (Account still lists approvals), and `T` / `⌫` on rows.

### D25

Settings lists **only what is tracked**, and adding is a **separate picker** (owner, 2026-11-02). Repositories and
Projects each show the tracked ones grouped by owner, without ticks or an owner filter (the list is short), and a row
opens that repository's or project's settings page (T16), because each now has settings of its own. Each row untracks
with one button (⌫). "Track repositories" / "Track projects", or a group's "Track more", opens a picker with search,
owner filter and multi-select; it commits on its own button, so the staged save and the Pending changes bar of D24 are
gone from Settings. First sign-in keeps its chooser (G2). Replaces the Settings half of D24. Screens G8, T17.
The picker is **the first sign-in chooser in a modal of its own** (owner, 2026-11-02), not a palette shaped like the
command menu: the same chooser both times, for repositories (T18) and projects (T22). **Untrack acts at once, with
Undo** (owner, 2026-11-02; T20): the row leaves the list and a toast offers Undo (⌘Z) for 10 seconds; the copy in this
browser is deleted only when the toast goes. No confirmation on the row.

### D27

The first sync reads **a few things at once** (owner, 2026-11-03, 2 at once for closed items): four repositories for
their open items, two for their closed ones, the four "my work" searches together and three of a group's item batches.
Workflows wait for the open items, unless a screen asks for them. When GitHub asks to slow down, every loop waits, and
the download's other repositories stop at their next page. Departs from GitHub's advice to "make requests serially
instead of concurrently" (Q2), for the first sync's sake.

**Why.** The first download read one page at a time, and pull request pages are what takes the time. Workflow runs,
suspected first, run beside the download and do not hold it back.

> **Checked 2026-11-03 (live, the owner's 12 repositories, 1,099 items, one run, serial):** "my work" 10.2 s (one
> `ItemsByIds` of 50 pull requests: 5.9 s), open items 14 s, closed items 106 s. 54 pull request pages took 111 of the
> download's 120 s of requests, about 2 s each. 88 workflow requests overlapped the download, which sat idle for
> 231 ms in all.

> **Checked 2026-11-03 (live, same repositories, one run, this decision):** "my work" 7 s, open items 5.5 s, closed
> items 70 s. Up to 7 requests in flight and no refusal, at about 2 s of GraphQL response time per second for 70 s.

**Known cost.** GitHub allows "60 seconds" of GraphQL CPU time per 60 seconds of real time and says response time
estimates CPU time roughly, so this may reach that limit on more or larger repositories; one run does not rule it
out. A refusal costs a pause and goes on from the last cursor.

**Rejected.** Four repositories at once for closed items: the longest load against that limit. A lighter query for
closed pull requests (2.5 s to 1.4 s a page, measured on `healedcare/healed`): rows would lose checks and diff size.

### D28

**A pull request on a list always looks the same, and so does an issue** (owner, 2026-11-03). One row and one card in
every list, in code and in `githq.pen`. A project's list is the same two-line `List row` as the others, with its field
values on the second line; `Table row` is gone, and the design now draws what the code already did.

A pull request's **size shows everywhere, on by default**: my work, a repository, a project, tracked or not, nested under
an issue or in a stack, on a row or a board's card. It stays a property in Display (D4), so a choice kept on a device
still holds.

The numbers are **green and red, in colours of their own**: `diff-added` and `diff-removed` (`#7EE787` and `#FFA198` since [D37](#d37)), paler than
the states `green` and `red`. They are data, not an alarm, and shouldn't read as a failing check or a passing one. Every
+/− counter uses them; the tints behind a diff's rows stay.

People stay different on purpose: my work shows who opened it, a repository and a project who it is assigned to (D11).

**Why.** The owner saw grey numbers that were hard to tell apart, and rows that differed by place. Those differences were
accidents, not decisions: a nested row dropped the size, a repository's defaults left it out, a project couldn't show it,
a card had no place for it.

**Rejected.** Size always on, with no option in Display: consistent, but it can't be hidden. Size on list rows only: a
pull request would look different on a board. Keeping `Table row` for projects: aligned field columns, at the price of the
one list that differs, and of a design the code doesn't follow. Showing assignees everywhere: my work would lose who asked
for a review.

### D29

**Closing acts at once, with Undo** (owner, 2026-11-04). A pull request has no reason to close for, so "Close pull
request" is one action, not a submenu holding a second "Close pull request", and `Shift+X` closes it there and then;
reopening is one action too. With no step left to catch a slip, every close offers Undo: a toast names what closed, with
Undo (⌘Z) for 10 seconds, as untracking does (D25). An issue's close keeps its submenu, for the reason, and gets the same
toast, and so does closing several items.

**Undo reopens.** The close goes to GitHub at once, like every other edit (D8), and Undo sends a plain reopen, so it is
visible on github.com as closed and reopened, and it can fail like any edit (a failed edit's toast says so). A close GitHub
refused offers no Undo. Undo returns the cursor, and an open panel or modal, to the undone item (owner, 2026-11-04).

**Rejected.** Holding the close back until the toast goes, which would leave no trace on GitHub: the item would look closed
here while it is open everywhere else, and closing the tab would have to send it or lose it. A confirmation step: slower on
every close, to guard against a rare slip that Undo already covers.

### D30

**What a control or a state needs to be seen reaches WCAG AA** (owner, 2026-11-04, issue #119). The dark, calm palette stays; superseded by [D37](#d37), which replaces the palette and keeps this rule. Values below are from before it.
Text already passed everywhere it was measured, except in the two states below; what fell short was the graphics. Fields
and checkboxes get an outline of 3:1 (`control-border`, the value of `fg-3`), commit graph lines too (`graph-line`,
`#646B75`, the default branch's line staying brighter), and `red-quiet` moves to `#AC4D52`. Dim rows lose their opacity
and use `fg-dim` and `fg-3` instead: stack members below the line and rows not matching a filter. The undone chip loses its
tint. A current project or repository section tab gets weight 500, and the current item of the collapsed sidebar an accent edge, because a fill
of 1.13:1 alone doesn't tell them apart. `border-2` stays for what doesn't need it: cards, label pills, keys.

**Why.** Measured across every story and the e2e screens, rendered and composited (`packages/e2e/src/audit/`,
`packages/app/styles/tokens.test.ts`). Outlines read 1.27–1.50:1, graph lines 1.99–2.35:1, opacity on dim rows down to
1.84:1, against 3:1 for graphics and 4.5:1 for text.

**Known cost.** Fields are visibly brighter, the largest change to the calm of the UI. The read-only checkbox stays the
design's grey box, rather than the code's half-opaque accent.

**Rejected.** Checkboxes only: text fields would still miss 3:1 and need a recorded exception. A brighter `border-2`:
every card, pill and key would pay for what only controls need.

Labels stay: their colour is a dot beside a name in `fg-2`, so it carries nothing the name doesn't say. A disabled control
is exempt in WCAG.

The rows of a stack map and the members of a stack's card are **24 px tall** (owner, 2026-11-04): 23 and 20 before, under
WCAG 2.5.8's minimum, and every other row was already over it. The ticks of a workflow's run strip
**stop being links** (owner, 2026-11-04): a new one starts every 10 px, under the same minimum. Hovering one still names its
run, and a click on the strip is a click on the row: the latest failed run on the cross-repository screen, and in a
repository's tab what the row does there. An older run takes two clicks and a tick can't be modifier-clicked into a new tab;
widening the strip past 100 px in every row was rejected, and so was recording an exception.

**Dim text is `fg-dim` in the design too** (owner, 2026-11-04): `fg-3`, at 3.54:1 on the window, is for icons and decoration
only, as the code already had it. A repository's current section tab gets weight 500, like a project's.

### D31

**A pull request's row and card say when its checks passed and when it is ready to merge** (owner, 2026-11-04, screen D7). An
open pull request with no review needed that GitHub would merge reads "Ready to merge", with the same "Merge" follow-up as an
approved one, whether it has checks or not. Green checks with something else holding it read "Checks passed" before the other
status: "Your review requested", "Waiting for review", "Draft", "Changes requested", or nothing else. Approved and held reads
"Approved · checks passed" in one. With no checks, nothing is said about checks. Nothing changes while it is being merged, in a
queue, on auto-merge, or when a merge's end speaks for it.

**Why.** A row with no status could mean checks passed, no checks, or not known yet, and a row "Waiting for review" said nothing
of its checks.

**A review asked stays "Waiting for review"** when none is required, although GitHub would merge it: it was asked for, and a
"Merge" there invites skipping it. **Known cost:** the opened item's verdict says "Ready to merge" in this one case.

**Rejected.** "Ready to merge" alone: says nothing of the checks of a pull request waiting for review. "Checks passed" alone:
leaves one with no checks saying nothing, and offers no "Merge".

### D32

**The screen's repository is a context of the command menu** (owner, 2026-11-04). When no opened item or selection takes
the chip, a chip names the repository; ⌫ steps out from the item or selection to the repository, and again to none. A group
headed by its name sits above "Go to": its sections (Workflows only while it is tracked), Open on GitHub, Copy link and
Repository settings (only while tracked). On its view the sections keep their keys `1`–`4` and act as its tabs.

**Rejected,** by the owner: any tracked repository's sections from elsewhere by typing; the existing repository line stays
the way there.

**Left out:** Stop tracking, because an Enter would stop tracking: it stays in the sidebar's menu. New issue, because `C`
already starts in the screen's repository.

[D36](#d36) changes two of these: any repository's sections are now reached from elsewhere, by its level or by typing its
name, and a repository walked into offers New issue. The screen's own group still has no New issue.

**"Settings" stays the app's** (owner, 2026-11-04): a repository is in context nearly always, so the repository's line is
"Repository settings", and "settings" + Enter opens the app's Settings there too. Rejected: "Settings" in the group, which
took that Enter and made the app's screen harder to reach.

### D33

**The desktop app's update screens are drawn in `githq.pen`, frame "Desktop · Updates" (U1–U48), following
[desktop releases](../desktop-releases/DECISIONS.md).** (design agent, 2026-11-04, for the owner to overrule.) What changed is the section
Changelog, the owner's choice ([D17](../desktop-releases/DECISIONS.md#d17)).

- **The outcome of a check started from the palette appears at the right end of the status bar, not in a toast.** That's where
  U1 already speaks and the palette has just closed. Up to date goes away by itself; a failure stays until Try again or
  Dismiss.
- **The confirmation to Stable names no version,** since that would take a request before the dialog could open, and it
  would then need its own states.
- **Offline, the switch to Stable stands and is not undone.** [D5](../desktop-releases/DECISIONS.md#d5) holds no state, so the
  newest Stable installs once GitHub can be reached.
- **The update toast** has the key ⌥W. It went from "until dismissed" to brief, and a ready update moved from the status bar
  into a toast, with [D40](#d40). Every toast sits in the bottom right corner ([desktop releases D7](../desktop-releases/DECISIONS.md#d7)).

**Rejected.** A second button for Try again in Settings: Check for updates already is that. Disabling the stream block on
Windows: a choice that leads nowhere, so it isn't drawn.

### D34

**Any repository GitHub shows the user can be found from the command menu, browsed as if tracked, and tracked from there**
(owner, 2026-11-04). In the owner's words: "to search GitHub for any repository, enter it and browse it as if it were our
repository... it is not tracked, so we don't fetch in the background, only on demand... never in the background". A
repository only browsed is **browsed**: a third kind of local data beside "about me" and "tracked" ([D4](#d4)).

**Every untracked repository's screen is this full view,** however it was reached: search, a typed `owner/name`, a link, a
row of my work's "Other repositories". The same toolbar, List and Board, state filter, grouping and sort as a tracked
repository, plus a "not tracked" chip and how much is read. Rows edit as tracked ones do, by the user's permission. This
replaces J3 for repositories (J5, J6); untracked projects keep theirs. Workflows stay tracked-only (actions D4) and Commits
does not change. When GitHub does not show the repository the screen says so, with the way to GitHub, and asks nothing more
(J7).

**The rows are ordinary items in the item store, held by a hold.** A tab holds a repository while its screen is open there
and for 10 minutes after leaving it. The user's other tabs know of the hold through presence, and it ends with its tab. Once
none holds it, the rows nothing else keeps go at my work's next clean-up; a row in my work, a tracked repository or a tracked
project stays as before. No cap while held, since each page is the user scrolling. **No sync loop reads a browsed row:** not
the change polls, pull request statuses, stack reads or detail prefetch. Requests come only from the section on screen, its
scrolling, or the user opening an item.

**When it reads.**

- A section read within the last 10 seconds asks nothing on entering. Otherwise the cached rows show at once and one REST
  conditional check goes, free when GitHub answers 304.
- While the section is on screen in a visible tab, the check repeats every 60 seconds, the interval of a tracked
  repository's change poll. Only the section shown is checked.
- Pages come on scroll in List, 100 issues or 30 pull requests at a time. On the Board, whose columns scroll on their own,
  one "Read more" button in the toolbar reads the next page. So does the same button in List while a group is collapsed: a
  page landing wholly in that group leaves the list's end where it was, and reading would otherwise stop until the group is
  expanded.
- The toolbar says "N of M": M is GitHub's total for the section and state, N the rows listed for them. Grouping and sort
  work on what is read. A stack is shown as far as read and is never completed by reading more of it.

**Tracking also starts from the command menu:** "Track repository" on an untracked repository's screen, the last line of the
repository's group ([D32](#d32)), so that a plain Enter cannot start it. "Stop tracking" stays out of the menu by D32, in the
title's and the sidebar's menus. Until now Settings was the only place
([settings-sync D15](../settings-sync/DECISIONS.md#d15)), and Settings keeps its picker. "Search repositories…" is a command in the menu, and only its submenu asks GitHub, from two typed characters once typing pauses.
Nothing else outside the menu: no button for search or tracking on the screen. Screens E6 to E10.

**Why.** Looking through someone else's repository meant either tracking it, which mirrors it in full and polls it for good,
or leaving for github.com. Reading only what the user scrolls to keeps a repository of thousands of issues cheap, and a hold
keeps coming back to it instant without any request in the background.

**Known cost.** Counts per group and a board's columns describe what is read, not the repository. Paging positions don't
survive a reload: the section reads from its first page again. While a group is collapsed the list reads on only as a page
adds rows on screen, so that a short list doesn't read the whole repository into that group.

**Rejected.** A separate in-memory store with read-only rows: simpler to keep out of the sync loops, but the owner picked full
edits in the shared store (2026-11-04), so a browsed row behaves like any other. Reading a whole section at once: a large
repository would cost its whole allowance for a look. A refresh with no poll: rows on screen would go stale in silence,
when the conditional check is free.

### D35

**The landing page says only what someone needs to choose.** (user, 2026-11-05.) Drawn in `githq.pen`, "Landing — githq.dev" and its mobile frame, with LP30; `/download` in "Landing · Download page" (LP17–LP19).
Two larger buttons, each with a title and a subtitle: "Download the app", "Best experience, in its own window", and "Sign in
with GitHub", "In your browser, nothing to install". One line of fine print under both: "All downloads · No new tracker ·
Nothing stored outside GitHub", the first a link to `/download`.

- **The icon on "Download the app" is the logo of the visitor's system,** the plain download icon when the system isn't known or on
  a phone. It is the only thing that changes with the system, at one size, so nothing shifts.
- **The permission line leaves the landing page.** This supersedes the first point of [D21](#d21) there: GitHub's consent
  screen comes straight after the click, unexplained. `/download` keeps the line with its "Why?", and the Privacy page keeps
  the explanation.
- **The Windows warning and "Signed and notarized" are on `/download` only,** so one click on Windows meets SmartScreen
  unwarned.
- **On `/download`, someone signed in sees "Open githq"** in place of Sign in, in the toolbar and in the browser path, with no
  permission line, because nothing is being asked (LP19).
- **Star on GitHub is a pill above the headline,** and the toolbar has the GitHub mark, Sign in and a small Download, which
  opens `/download`.

**Rejected.** Two buttons with GitHub only in the toolbar, one button with the browser as a sentence, two equal cards (never committed).
Lines under the buttons that change with the system: more than the page needs.

### D36

**The command menu is a tree with a rule for its top** (owner, 2026-11-05). The top holds the current context (the
actions of the subject, the screen and the screen's repository), what the sidebar shows and what the app proposes now.
Everything else hangs under a parent.

- **Go to:** the draft reviews, my work and its groups, the broken workflows, and Settings, which holds its sections; Account
  holds Sign out, and in the desktop app Updates holds Check for updates and the switch of stream.
- **Projects:** every tracked project, holding its saved views, New issue, Open on GitHub, Copy link and Settings.
- **Repositories:** every tracked repository and a typed `owner/name`, holding its sections, New issue, Open on GitHub, Copy
  link, Settings and, last, Track.
- **App:** New issue, Keyboard shortcuts, Search repositories…, and Restart to update, Try again and Update later while
  they can run.

**Drill-in.** A row with a level has a chevron. Enter does what the row does, so a repository, a project or a section of
Settings goes to its screen; → (at the end of the text) or Tab enters the level without going anywhere; ←, ⌫ in an empty
field and Esc step back one level, the field empty. Crumbs show the way. The context's chip stays while the path starts at
one of the context's commands and hides inside a place, which it is not about. The other repositories, projects and places
stay at the top under any chip, without ⌫ first.

**Scoring by the path.** A nested row's score is its own match times a factor for every level above it.

- A level the text names, words from its start in path order, costs `(1 + m) / 2`, with `m` its match on a 0 to 1 scale: "api
  pull" finds "acme/api → Pull requests". A match of at least 40 counts as naming it, so scattered letters don't.
- A level the text does not name costs a weight: 0.8 over the options of the subject's actions, so that "in prog" on an item
  still finds its status, and 0.6 over the rest.
- The children of repositories and a project's actions are found only with their parent named, or "pull" and "copy" would
  list them once per repository and project. A project's saved views are found alone.
- A nested row needs an own match of at least 50 and a score of at least 20, or it is not shown. Rows of the top are not cut.
- Leaving the context costs ×0.9 for everything outside it, nested rows too. It only orders: the 20 is checked before it.

**Why.** All of Settings' sections, Switch to Stable and Sign out lay at the top, a repository's sections could not be
reached from elsewhere, and a deep option outranked a place: "pull" put "Show properties → Pull request status" above "My pull
requests".

**Left out:** drill-in on items and on the results of "Search repositories…"; the reversed order ("pull web"); restoring the
typed text on stepping back; clicking the chevron to enter, since a click still does what the row does.

### D37

**The app takes GitHub's colours, for how readable they are, not for how they look; indigo stays as the brand.** (user, 2026-11-05, #172.) Quoting the owner: "GitHub is very readable because of how carefully the proportions between colours and lightness are chosen, and that's why I wanted to copy it, not because I want to copy GitHub's branding." So every neutral, status and code colour comes from Primer's dark theme (`@primer/primitives` 11.10.0), and `#7B87F7` stays in the brand's places: the accent, the selected row, focus, links, its tints, the landing page's glows. D30's rule stands; only "the palette stays" is superseded.

**Why.** Reading code in a review took effort. Unchanged lines were drawn in `fg-2` (7.2:1 against GitHub's 17.4:1), and five muted syntax colours of one lightness barely told tokens apart.

- **Code is GitHub's whole:** seven syntax colours, grouped as in highlight.js's `github-dark` theme, unchanged lines at full brightness, GitHub's backgrounds on added and deleted lines. `section` and `bullet` take `constant` and `builtin`, because the theme's `#1F6FEB` fails AA on the window.
- **Exceptions to Primer, each kept by `packages/app/styles/tokens.test.ts`:**
  - `bg-3` `#1C2128`: Primer's `#212830` gives red 4.44:1 and `fg-3` 2.81:1.
  - `sel` `#181D2E`: the accent at Primer's accent-muted strength.
  - `fg-dim` `#8B929B`: Primer has two levels of text and we have three.
  - `graph-line-main` `#8B929B`: the default branch's line stays brighter.
  - `red-quiet` `#AC4D52`: Primer's `#B62324` reads 2.93:1.
- **The accent stays as it is:** at 5.99:1 on the window it already has the lightness of GitHub's `#4493F8`, 6.11:1.

**Known cost.** Code is much more colourful than the calm around it, and lines between surfaces are brighter. The landing hero, share image and README picture wait for #178, having no frame in the design to export from. Code samples in `githq.pen` stay one colour a line, each line being one text node. The app icons keep their old tile, a difference nobody could see.

**Rejected.** Tilting the neutrals towards indigo at the same lightness (seen side by side: kept within 0.13:1 of Primer, but the owner preferred the brand in its own places). Primer's blue accent: the app would read as a GitHub skin, and links would blur into blue code. Keeping our syntax colours and brightening unchanged lines only: not a proven scheme. One Dark: made for a lighter background.

### D38

**Short animations where something appears, all of them off with one switch.** (user, 2026-11-05.) Drawn in `githq.pen`, CH43 and CH49.
Overlays open with a fade and a small slide in about 150 ms, tooltips with a fade only, and content that folds unfolds through `Reveal`.
Everything closes at once: focus and the layer stay with an overlay until it leaves the page, so an Escape during a fade would be lost, and
every caller unmounts its toast on closing. Moving between screens or along a list is instant, and spinners run regardless, because they report status.
"Animations" in Display is on by default, syncs with the settings, and the system's reduce motion wins over it. The motion is opt-in CSS with
no Transition components, so a screen never knows about the switch.

**Rejected.** Own transition components reading the setting from a provider: reka-ui's `Presence` already follows CSS animations, so they
would add a wrapper at every overlay for nothing. Animating closing everywhere: keys typed during the close would reach the closing input.

### D39

**Issues and pull requests can be grouped by status and by author, in a repository and in My work.** (user, 2026-11-06.)
Drawn in `githq.pen`: J2 (the grouping menu), J8 and D8. Both groupings join the existing ones and change no default. Neither
group can be moved into, because an author can't be changed and a status follows from several GitHub facts.

- **A pull request's status** is the group its row's status line already tells, so the two can never disagree: Draft,
  Waiting for review, Needs work (failing checks, changes requested or conflicts), Checks running, Ready to merge (approved,
  or mergeable with no review), Merging (being merged, in the merge queue, auto-merge on), Merged, Closed. A pull request
  falls in the group of the first state its row would show, so a draft with failing checks is in Needs work and an
  approved draft in Ready to merge. An open pull request with nothing to say is in Waiting for review. What this session
  remembers of a refused merge, and an unsent draft review, change the row's words but not the group.
- **An issue's status** is GitHub's own state, as the row's icon shows it: Open, Closed (completed or no reason), Not
  planned (any other reason). With the default "Open" filter that is one group.
- **Author** is who opened the item, by login, with their avatar; an item whose author's account is gone is under "No
  author", last.
- **In My work,** status says what the item asks of the user, tied to the filters of [D11](#d11): Needs me (what the
  "Needs me" filter keeps), Ready to merge (my pull requests), Waiting on others (what that filter keeps and "Needs me"
  does not), Draft (my drafts), Other. Rows move whole, as by repository ([D22](#d22)): a pull request nested under the
  issue it closes stays under it, a stack's entry stays whole, and the counts still add up to the total.
- Only groups with items are shown, in both layouts. In a repository a stack splits across status or author groups, as it
  does across milestones.

**Rejected.** An issue's status from a project's Status field: its options differ per project, and the project views
already group by it. A draft always in Draft, whatever else it says: its group would then disagree with its row.
Moving a pull request between Draft and Ready for review by dragging it: left for later.

### D40

**Toasts follow one set of rules: one stack in arrival order, keys only on the newest, three lifetimes.** (owner,
2026-11-06.) Drawn in `githq.pen`, App · Toasts (N1–N5) and Desktop · Updates (U49–U51).

- **One component, one corner.** Every toast is `Toast.vue` in the bottom right corner above the status bar, 480 wide:
  icon in its tone, title, what happened, the actions as small secondary buttons with their keys, Dismiss (Esc) last. No
  primary or ghost buttons in a toast.
- **The stack is in arrival order,** the newest at the bottom, nearest the corner, whichever kind it is.
- **Keys go to the newest toast only.** Its action keys and Esc work and their hints show; the toasts above show no keys,
  but their buttons still work with the mouse. When the newest goes, the one before takes the keys. So ⌘Z always undoes
  the last thing done, and one Esc dismisses one toast.
- **Three lifetimes.** Brief, 6 s: news and outcomes (merged, reverted, updated to a version, a repository that couldn't be
  tracked, a viewed mark GitHub refused). Long, 10 s: Undo (a close, an untrack) and failures the status bar keeps anyway
  (an edit, a re-run). Pinned, until acted on or dismissed: what needs a decision (a refused merge, settings sync stopped,
  a ready desktop update, a new version on the web). Hovering or focusing a toast stops its clock; a timed toast drains an
  accent ring around its ×.
- **Updates are toasts.** A ready desktop update is a pinned toast with Restart (⌥R), its Dismiss being Later; a quiet
  offer stays in the status bar after it. The web says a new version was deployed with a pinned toast and Reload (⌥R);
  it never reloads the screen in place, though the next move to another screen loads the new version, as Nuxt does to
  keep the old build's missing files from breaking navigation.
- **Untracking from the sidebar or ⌘K offers Undo,** as from Settings ([D25](#d25)).

**Why.** Each toast kind had grown its own lifetime (5, 10, 12 seconds or until dismissed) and its own buttons; two Undo
toasts answered ⌘Z by whichever registered first, and one Esc dismissed every toast, untracking at once. A ready update
was easy to miss in the status bar.

**Rejected.** Only one toast visible at a time, the rest queued: hides what happened. Actions disabled on older toasts:
a click is never ambiguous. Every toast in its own lifetime: the reason to have rules.

## Open questions

### D26

Settings is **a column of sections**, as the repository's column layout, rather than tabs along the top (owner,
2026-11-03): Repositories, Projects, Display, Code review, Sync settings, Account, on `1`–`6`, the rows roomy enough to click
comfortably, with no descriptions (tried, and they looked poor). The page's header holds
only the section's name, and with a column there is room for more sections, so a setting goes where it belongs: the
repository layout in Display, what a comment does by default in Code review. Where settings are saved is no longer a
line on the page but part of the status bar ("Up to date · settings saved in …"). Screens: App · Settings, all of
them, and the component `Settings / Sections column`.

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
User doesn't know typical scale (2026-10-12: "hard to say"), so the answer must not depend on it.

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
Built that way (2026-10-31): lock `githq-sync-<login>-v<N>`, the syncing tab sends its store changes over the
channel, the others apply them to memory only; without Web Locks every tab syncs. `N` is the local copy's layout, as in
the channel's name: a tab left open across a deploy that raised it must not hold the new one back. Told of a newer
layout, such a tab gives the lock up and reloads once that loses nothing (`OutdatedTabReload`).

### Q11

Typing answered by [D19](#d19). Original: GitHub client shape: REST with ETags for change detection (free 304s, [D7](#d7)), GraphQL for bulk reads and
writes (one request for an item with its project fields). How GraphQL queries are typed (codegen vs. a typed
document library) — not chosen. Open.
