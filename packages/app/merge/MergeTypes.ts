import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';

import type { ItemCheck } from '@/store/ItemDetailTypes.js';
import type { PullRequestStatus } from '@/store/ItemTypes.js';

/**
 * What the merge panel of a pull request decides from, read fresh when it opens (`PullRequestMergeOptions`): the
 * status (its `headRefOid` is the head the merge names), the texts GitHub proposes, what the base branch allows,
 * and the checks with which of them are required.
 */
export interface MergeOptions {
    readonly status: PullRequestStatus;
    readonly baseRefName: string;
    /** The commit texts GitHub proposes to the viewer; a rebase makes no commit of its own, so it has none. */
    readonly proposedTexts: { readonly MERGE: MergeCommitText; readonly SQUASH: MergeCommitText };
    /**
     * The methods the base branch's rulesets allow: those every pull request rule allows. `null` when no ruleset
     * restricts them; the repository's settings narrow them further (`RepositoryMetadata`).
     */
    readonly allowedMergeMethods: readonly PullRequestMergeMethod[] | null;
    /**
     * The base branch takes no merge commits — required by a ruleset or by classic branch protection (`false` when
     * the viewer cannot read the protection).
     */
    readonly requiresLinearHistory: boolean;
    /** The viewer may merge past unmet requirements. */
    readonly viewerCanMergeAsAdmin: boolean;
    readonly viewerCanEnableAutoMerge: boolean;
    /** Merges into the base branch go through GitHub's merge queue. */
    readonly isMergeQueueEnabled: boolean;
    /** The checks of the head commit; empty when nothing runs. */
    readonly checks: readonly MergeCheck[];
    /** How many checks there are; more than {@link checks} holds when GitHub cut the list (100). */
    readonly checkCount: number;
}

/** A commit's title and message. */
export interface MergeCommitText {
    readonly title: string;
    readonly body: string;
}

/** A check of the head commit, as the merge panel lists it. */
export interface MergeCheck extends ItemCheck {
    /** The base branch requires it to pass before the merge. */
    readonly isRequired: boolean;
    /** The GitHub App that ran a check run (`github-actions`); `null` for a commit status. */
    readonly appSlug: string | null;
    /** The Actions workflow run a check run belongs to, to re-run it; `null` outside Actions. */
    readonly workflowRunId: number | null;
}
