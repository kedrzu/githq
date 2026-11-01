# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the decision's ID alone,
so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired decisions, the journal and notes
from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history they link to.**
Reopening a rejected option is right when its premise changed; repeating it without knowing it was rejected is
not.

## D1

**githq merges pull requests, with the checks and merge options github.com offers for that repository.**
(2026-11-01, owner)

**Why.** The owner asked for it. Their reason is still to be recorded in the README.

> **Checked 2026-11-01:** the app already lists a pull request's checks with their state
> (`packages/app/item/PullRequestChecks.vue`), but does not read whether a check is required: no operation asks
> for `isRequired` (`packages/github/src/operations/`), which the schema has and which answered live.

> **Checked 2026-11-01 (live, read-only query on `kedrzu/githq` #32):** GitHub proposes the commit message per
> method: `viewerMergeHeadlineText(mergeType: SQUASH)` gave "Ship githq as a Tauri desktop app (#32)",
> `viewerMergeBodyText` the description. The schema has no field saying whether the viewer may merge;
> `viewerPermission`, `viewerCanMergeAsAdmin`, `viewerCanEnableAutoMerge`, `viewerCanUpdateBranch`,
> `viewerCanDeleteHeadRef` and `isMergeQueueEnabled` exist.

> **Checked 2026-11-01:** `mergeable` is computed in the background and can read `UNKNOWN`
> ([GraphQL reference](https://docs.github.com/en/graphql/reference/pulls): "still being calculated").
> `expectedHeadOid`: "OID that the pull request head ref must match to allow merge; if omitted, no check is
> performed." The error on a mismatch is not documented.

> **Checked 2026-11-01, not found:** the
> [scopes page](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) does not
> say whether merging a pull request that changes `.github/workflows` needs the `workflow` scope. githq asks for
> `repo`, `project` and `read:org`. Needs a live test with a token of exactly those scopes.

**Rejected.**
- Showing mergeability and opening github.com to merge — the earlier decision in
  [the githq design](../githq/DECISIONS.md#d10), which the owner has now reversed. It was the agent's
  recommendation, adopted among other corrections.

## D2

**The merge methods offered are those allowed by the repository settings, the target branch's rulesets and its
linear-history rule, all together.** (2026-11-01, proposal of the design agent, not yet confirmed)

**Why.** Offering a method one of them forbids gets a rejection from GitHub after the user has already chosen
and written the message.

> **Checked 2026-11-01 (live, `kedrzu/githq` #32):** settings `mergeCommitAllowed: false`,
> `squashMergeAllowed: true`, `rebaseMergeAllowed: false`, `viewerDefaultMergeMethod: SQUASH`. `main`'s
> `baseRef.rules` returned `PULL_REQUEST` with `allowedMergeMethods: ["SQUASH"]`, and
> `REQUIRED_LINEAR_HISTORY`. `viewerMergeHeadlineText(mergeType: MERGE)` still answered, so a proposed message
> does not show that a method is allowed.

> **Checked 2026-11-01:** a ruleset can require a merge type, and one the repository has disabled blocks the
> merge ([available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)).
> A merge queue has its own merge method
> ([managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue));
> the page does not say whether the person merging can override it.

**Rejected.**
- Repository settings alone — a ruleset can narrow them, and the user then meets the refusal only on merging.
