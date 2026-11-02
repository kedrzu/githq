# Retired decisions

Decisions that held once, in full, under their original IDs. Never edited after they are written, apart from adding
the next retired form.

## D17

Retired 2026-11-02, replaced by the current [D17](../DECISIONS.md#d17): a single comment cannot be posted
while a draft review is open.

**A comment goes either straight to the pull request as a single comment, or into a draft review — GitHub's
pending review — submitted later as one review. A setting chooses which one `Cmd+Enter` does; `Cmd+Shift+Enter`
always does the other.** (2026-11-02, owner: "some prefer to write a draft review and then throw it all as one
review, others prefer single comments; GitHub imposes one way") The setting is local, like every preference so far —
agent's reading, the synced settings holding only what is tracked ([settings-sync D7](../settings-sync/DECISIONS.md#d7)).

**Why.** Both habits exist and GitHub's screen pushes into a draft as soon as one is started (owner). A pending
review lives on GitHub, so a draft survives closing githq and is visible on github.com; each pull request of a
stack has its own.

> **Checked 2026-11-02:** `AddPullRequestReviewThreadInput` takes either `pullRequestReviewId` (into a pending
> review) or `pullRequestId`, plus `path`, `line`, `side`, `startLine`, `startSide`, `subjectType`
> (`packages/github/src/schema.graphql`). Whether a single comment can be posted while the user has a pending review
> on the same pull request is open: [Q7](#q7).

