import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';

import type { EditFailureReason } from '@/edits/EditTypes.js';
import type { PullRequestWayForward } from '@/item/usePullRequestVerdict.js';
import type { ItemCheck } from '@/store/ItemDetailTypes.js';
import type { PullRequestStatus } from '@/store/ItemTypes.js';

/**
 * What the merge panel of a pull request decides from, read fresh when it opens (`PullRequestMergeOptions`): the
 * status (its `headRefOid` is the head the merge names), the texts GitHub proposes, what the base branch allows,
 * and the checks with which of them are required.
 */
export interface MergeOptions {
    readonly status: PullRequestStatus;
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

/** A merge the user asks for in the merge panel. */
export interface MergeRequest {
    readonly method: PullRequestMergeMethod;
    /** The commit's title, only when the user edited it: GitHub's own default goes otherwise (D6). */
    readonly title?: string;
    /** The commit's message, only when the user edited it: GitHub's own default goes otherwise (D6). */
    readonly body?: string;
}

/**
 * How GitHub took a merge at first: it accepted it (it may still fail while it runs, reported like a failed edit),
 * or refused it at once — the merge panel stays with its text and says why.
 */
export type MergeAnswer =
    | { readonly kind: 'accepted' }
    | { readonly kind: 'refused'; readonly reason: EditFailureReason };

/**
 * A step the merge panel takes towards the merge when it can't merge yet — its way forward (merging D12): mark the
 * draft ready for review, bring the base branch in, or resolve the conflicts in GitHub's editor.
 */
export type MergeStep = Exclude<PullRequestWayForward, 'merge'>;
