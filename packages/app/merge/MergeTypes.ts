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
    /** The commit message auto-merge will use; `null` when it is off, or GitHub writes its own (PM11). */
    readonly autoMergeBody: string | null;
    /** The method the base branch's merge queue merges with, by its ruleset; `null` when no ruleset says. */
    readonly mergeQueueMethod: PullRequestMergeMethod | null;
    /** The checks of the head commit; empty when nothing runs. */
    readonly checks: readonly MergeCheck[];
    /** The head commit as it is said when a merge was refused for naming an older one (PM27); `null` when unread. */
    readonly headCommit: MergeHeadCommit | null;
}

/** A pull request's head commit, as the merge panel names it. */
export interface MergeHeadCommit {
    readonly oid: string;
    readonly headline: string;
    /** Its author's login, else the name in the commit; `null` when it names none. */
    readonly author: string | null;
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
    /** Past the requirements not met, by the panel's own chord (D12, PM12a). */
    readonly bypassRules?: boolean;
    /** The commit's author, only when the user chose another than their default: it goes through GraphQL (D5, PM6). */
    readonly authorEmail?: string;
}

/** A merge as the merge panel sends it: the request, and the commit text the user edited, whole, to give it back. */
export interface MergeSubmission {
    readonly request: MergeRequest;
    /** The commit text as edited, title and message both; `null` when the user left GitHub's text as it was. */
    readonly edited: MergeCommitText | null;
}

/** A merge this session sent: what the panel sent, with the head commit it named. */
export interface SentMerge extends MergeSubmission {
    readonly head: string;
    /** A stack's merge of two or more: every pull request going, first to last, the top last (stacked PRs D11). */
    readonly going?: readonly string[];
    /** It named no method, as a merge queue has its own: no refusal of it is about one (`sendsMergeMethod`). */
    readonly withoutMethod?: boolean;
}

/**
 * What this session knows of a pull request's last merge that did not end merged (merging D3, D15), as GitHub
 * answered it: refused, with GitHub's reason (PM25, PM31), or no answer — accepted with no result in time (PM29), or
 * the request itself unanswered, as it may have reached GitHub all the same. How it reads is told where it shows,
 * from the pull request as it is then ({@link MergeEnd}). Kept in memory only: a reload or another account forgets it.
 */
export type MergeRecord =
    | MergeRefusedRecord
    | {
          readonly kind: 'unknown';
          readonly sent: SentMerge;
          readonly at: number;
          /** GitHub accepted it and said no result in time (PM29); `false`: the request itself went unanswered. */
          readonly accepted: boolean;
          /**
           * GitHub refused a stack's merge, and the stack was not read again since (stacked PRs D11): what landed is
           * not known, and this is what GitHub said.
           */
          readonly refusal?: EditFailureReason;
      };

/** A merge GitHub refused, with its reason ({@link MergeRecord}). */
export interface MergeRefusedRecord {
    readonly kind: 'refused';
    readonly sent: SentMerge;
    readonly reason: EditFailureReason;
    /** Epoch ms GitHub answered: a copy of the pull request read after it says more. */
    readonly at: number;
    /**
     * The head commit read after the refusal, while it is the pull request's head: who pushed it, for the panel, the
     * rows and the opened item to say (PM27, PM37).
     */
    readonly headCommit?: MergeHeadCommit;
}

/**
 * How the last merge that did not end merged reads, from its record and the pull request as it is now
 * (`getMergeEnd`), for the merge panel and the rows to say, with the text to give back: refused with GitHub's reason;
 * refused because the head moved since the merge named it — told by the head now, not by GitHub's words (PM27);
 * refused for a method the base branch's rules, read after it was sent, don't allow (PM28); or no answer (PM29).
 */
export type MergeEnd =
    | { readonly kind: 'refused'; readonly sent: SentMerge; readonly reason: EditFailureReason }
    | {
          readonly kind: 'headMoved';
          readonly sent: SentMerge;
          /** The head GitHub holds now. */
          readonly head: string;
          /** The commit at it, when the merge panel's read brought it. */
          readonly commit: MergeHeadCommit | null;
      }
    | { readonly kind: 'methodNotAllowed'; readonly sent: SentMerge }
    | {
          readonly kind: 'unknown';
          readonly sent: SentMerge;
          /** GitHub accepted it and said no result in time; `false`: the request itself went unanswered. */
          readonly accepted: boolean;
          /** GitHub refused a stack's merge, and what landed is not read yet: what GitHub said. */
          readonly refusal?: EditFailureReason;
      };

/**
 * How a merge GitHub accepted ended: merged, refused while it ran, or with no answer in time.
 */
export type MergeLateEnd =
    | { readonly kind: 'merged' }
    | { readonly kind: 'refused'; readonly reason: EditFailureReason }
    | { readonly kind: 'unknown' };

/**
 * How GitHub took a merge at first: it accepted it (it may still fail while it runs, reported like a failed edit);
 * it said merged at once, which it does only for a pull request merged already (PM30) — the merge panel stays and
 * says so; or it refused it at once — the merge panel stays with its text and says why.
 */
export type MergeAnswer =
    | { readonly kind: 'accepted' }
    | { readonly kind: 'merged' }
    | { readonly kind: 'refused'; readonly reason: EditFailureReason };

/**
 * A step the merge panel takes when it doesn't merge itself — its way forward (merging D12), adding to a queue being a
 * merge: mark the draft ready for review, bring the base branch in, resolve the conflicts in GitHub's editor, turn
 * auto-merge on or off. Off to the side, each with a key of its own: jump the queue, take it out of the queue (PM14, PM15).
 */
export type MergeStep = Exclude<PullRequestWayForward, 'enqueue' | 'merge'> | 'dequeue' | 'jumpQueue';
