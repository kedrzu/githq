# Retired decisions

Full text of decisions, or parts of decisions, that no longer hold, under their original IDs.

## D7

Retired 2026-11-02 in part: the replace prompt for a second clone gave way to a message, see
[D7](../DECISIONS.md#d7).

**A GitHub repository has at most one local clone in githq; parallel work goes through that clone's
worktrees. Adding a worktree's folder adds its clone (resolved with `git rev-parse --git-common-dir`);
adding a second separate clone of the same repository offers to replace the first.** (2026-11-01, owner:
"we support only one clone per repo… opinionated, but so be it"; the handling of the two add cases is the
design agent's proposal)

**Why.** With worktrees a second clone gains almost nothing, and supporting it means several sets of local
branches in one graph and a choice of clone behind every local action.

**Rejected.**

- Several clones per repository — too much complexity for too little gain (owner).

## D9

Retired 2026-11-02 in part: the REST conditional ref checks and the date gate on drawing were dropped, see
[D9](../DECISIONS.md#d9).

**History is paged and kept like this** (2026-11-01, owner asked for the caching and paging design; the
mechanism is the design agent's proposal):

- **Kept:** commits (immutable fields of [D8](#d8)) per repository in IndexedDB, for good; refs (branches and
  tags with their target oid) as last seen. Everything is a rebuildable cache, as for the rest of githq.
- **Opening a repository seen before:** draw from the cache, then check refs with REST conditional requests
  (`GET /repos/{owner}/{repo}/git/matching-refs/heads` and `…/tags` with `If-None-Match`); only if they
  changed, fetch the moved refs' new commits.
- **Opening a repository the first time:** one GraphQL request for the branches, the tags and the default
  branch's first 100 commits; draw them. Then, for every branch tip not among known commits, fetch
  `history(first: 20)` in one batched request, and repeat deeper only for branches still not joined to known
  commits.
- **Scrolling down:** the frontier is the set of parents of loaded commits that are not loaded themselves;
  fetch `history(first: 100)` from the newest frontier commit and drop commits already known.
- **What is drawn:** rows ordered by committer date across all refs (`git log --date-order`), down to the
  newest date any loaded branch's frontier has reached — never past it, so a commit loaded later can never
  appear above rows already shown.

**Why.** It keeps every open after the first one free of network waits and costs nothing when nothing moved;
a first open shows rows after one request of about a second.

> **Checked 2026-11-01:** measured with `gh api`:
>
> - branches and tags (`refs(first: 100)` twice, oids only): cost 1, 0.83–0.86 s on `nuxt/nuxt` (67 branches,
>   339 tags, so tags need paging), 0.49–0.82 s on `kedrzu/githq`;
> - 100 branches × `history(first: 20)` in one request on `nuxt/nuxt`: cost 21, 3.06 s — the reason to fetch
>   only branches that are not yet joined;
> - `GET repos/nuxt/nuxt/git/matching-refs/heads` repeated with its `ETag` in `If-None-Match`: `304 Not
>   Modified`.
>
> Size: a page of 100 commits with the fields of D8 was 30.5 kB of JSON, about 300 bytes a commit, so even
> 30,000 commits fully scrolled would be roughly 9 MB (estimate from that one measurement).

**Rejected.**

- Fetching the whole history on first open — seconds to minutes for a large repository, for rows nobody
  scrolls to.
- Fetching every branch's history up front, joined or not — cost and latency grow with the branch count
  (21 points and 3 s for 100 branches) for branches that mostly share the default branch's history.
- Drawing commits as they arrive regardless of other branches' depth — rows would jump as later branches
  load.
