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

**Why.** githq's aim is to be the one place to run all of a user's GitHub projects and repositories, fast and
snappy like Linear: every day-to-day action, not repository settings. Code review is meant to follow, but is out
of scope here.

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
linear-history rule (from a ruleset or classic branch protection), all together.** (2026-11-01; following the repository's setup is the owner's, working it out this way is the design agent's)

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

## D3

**A merge shows as merged only once GitHub confirms it; until then the pull request reads as being merged and the
app stays usable.** (2026-11-01, owner)

**Why.** It cannot be undone, and githq's copy of the pull request can be out of date, so showing it merged at
once would sometimes claim something that did not happen. An edit's optimistic layer is drawn until `send` returns
a verdict (`packages/app/edits/EditTypes.ts:131`), so it draws "being merged" and `send` keeps asking for the result
of the merge ([why it has to](#d5)), with backoff and a time limit. `merged` and `enqueued` confirm, `failed` refuses,
and past the limit the regular sync decides. The state lives only in memory: after a reload the pull request reads
as whatever GitHub last said. The merge is not sent again, because if the earlier one failed that would start a new
one. In a queue or under auto-merge the state shown is GitHub's own (`mergeQueueEntry`, `autoMergeRequest`).

**Rejected.**
- Instant like other edits, rolling back on refusal — the user may have moved on before learning nothing merged.

## D4

**Every option github.com offers when merging is in: method, commit title and message, commit email, auto-merge,
merge queue including jumping it, stacks, updating the branch, merging past requirements the user may bypass,
deleting and restoring the branch, reverting, re-running GitHub Actions checks.** (2026-11-01, owner: "they all
have to be there, so as not to limit specific workflows"; the list is the design agent's inventory.)

**Why.** Leaving one out sends that workflow back to github.com, which is what this design removes.

> **Checked 2026-11-01:** the schema has `enablePullRequestAutoMerge`, `disablePullRequestAutoMerge`,
> `enqueuePullRequest`, `dequeuePullRequest`, `updatePullRequestBranch` (`MERGE`, `REBASE`), `deleteRef`,
> `createRef`, `revertPullRequest`.

> **Checked 2026-11-01:** Actions re-runs take the `repo` scope: "OAuth app tokens and personal access tokens
> (classic) need the repo scope" ([workflow runs](https://docs.github.com/en/rest/actions/workflow-runs)). Other
> checks: re-requesting a check run answers for the owning GitHub App only
> ([check runs](https://docs.github.com/en/rest/checks/runs)), so those link out. Not tested live.

> **Checked 2026-11-01:** the email selector offers verified addresses, is absent for rebase merges, and for squash
> appears only to a pull request's author with more than one address
> ([merging a pull request](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request)).
> Not found: what signoff does on a web merge or through the API
> ([signoff policy](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-the-commit-signoff-policy-for-your-repository)).

> **Checked 2026-11-01, not found:** an API for resolving conflicts, or for GitHub's "Rebase stack" button. Those
> link to github.com.

**Rejected.**
- A smaller first version without the commit email and admin bypass (the agent's suggestion) — the owner wants
  no workflow limited.

## D5

**Merges go through REST's asynchronous merge endpoint; GraphQL only for what it alone offers, a chosen commit email
and jumping the queue.** (2026-11-01, owner, on the design agent's proposal)

**Why.** One endpoint covers direct merges, queues, stacks and bypass, and stacks need it anyway, so asking for the
result has to exist regardless: a `202` only says the request was accepted. It follows the rule the owner set with it, now in
`AGENTS.md`: GraphQL whenever it can do the job, REST where it cannot.

> **Checked 2026-11-01 ([GitHub's OpenAPI description](https://github.com/github/rest-api-description)):**
> `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge-async` takes `commit_title`, `commit_message`, `sha`,
> `merge_method`, `merge_action` (`direct_merge`, `merge_queue`, `default`) and `bypass_rules`, and has no email or
> jump. "This is the required API for merging stacked pull requests. For a stacked pull request, the operation
> includes all open downstack pull requests." `sha`: "if the PR is pushed in between the merge being requested
> and being executed, the merge will be cancelled." A result stays readable for 24 hours (docs summary, not
> verbatim). OAuth scope not stated.

> **Checked 2026-11-01 (`packages/github/src/schema.graphql:28819`):** on `mergePullRequest`: "We recommend using
> the asynchronous merge REST API instead. This mutation does not support stacked pull requests." Its input has
> `authorEmail`; `enqueuePullRequest` has `jump`. With a merge queue any commit message given is ignored.

**Rejected.**
- `mergePullRequest` for everything — fits the GraphQL principle, but cannot merge a stack.
- Refusing stacked pull requests in githq — this repository itself works in stacks.

## D6

**A merge may be sent from what githq holds, without waiting for the read the panel starts on opening; the head SHA
goes with it, and the title and message only if the user edited them.** (2026-11-01, owner, on the design agent's proposal)

**Why.** Waiting adds a pause to every merge, and GitHub enforces the requirements itself, while the SHA cancels the
merge if the head moved ([evidence](#d5)). Accepted cost: a check that is not required may have just failed, and the
user merges before seeing it.

To make that possible, the row has to hold the head SHA and the repository's metadata its allowed and default
methods; no operation reads them today (only `packages/github/src/operations/` was searched). The read on opening
brings the rulesets, the proposed messages and fresh status. Sent before it arrives, an unedited message is GitHub's
own default, and a method a ruleset forbids is refused, with the panel and the text kept.

**Rejected.**
- No read on opening — the panel would have no proposed message to edit and no rulesets to narrow the methods.
- Waiting for the fresh read before enabling the merge — closes only that gap, and every merge pays for it.

## D7

**One merge panel, opened by one key from the opened pull request, the list and the command palette; it starts on the
default method and GitHub's proposed message, and ⌘Enter merges.** (2026-11-01, owner, on the design agent's proposal;
the key is not chosen)

**Why.** Two keys for the usual merge, and the second is a deliberate confirmation of something that cannot be undone.

**Rejected.**
- A single key that merges at once — cannot be undone.

## D8

**Several selected pull requests can be merged together: one confirmation, each with its own default method and
message; one failing does not stop the others, and the user sees which failed.** (2026-11-01, owner, on the design
agent's proposal)

**Why.** The case is a run of small pull requests such as five from Dependabot. Closing several at once already
exists (`packages/app/lists/ItemContextMenu.vue:241`).
