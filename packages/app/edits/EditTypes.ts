import type { GitHubSdk } from '@githq/github/createGitHubRequester.js';

import type { ViewerProject } from '@/repos/RepositoryTypes.js';
import type { ItemOverlayLayer } from '@/store/ItemOverlay.js';

/** How an issue is closed. */
export type CloseReason = 'COMPLETED' | 'NOT_PLANNED';

/**
 * A change the user asks for, of one item or of every item selected: by name, as the pickers show it. Each item
 * turns it into its own edits (`createItemEdits`), with its own repository's ids.
 */
export type EditRequest =
    | { readonly kind: 'labels'; readonly add: readonly string[]; readonly remove: readonly string[] }
    | { readonly kind: 'assignees'; readonly add: readonly string[]; readonly remove: readonly string[] }
    /** `null` clears it. */
    | { readonly kind: 'milestone'; readonly title: string | null }
    /** `null` clears it. */
    | { readonly kind: 'issueType'; readonly name: string | null }
    | { readonly kind: 'close'; readonly reason: CloseReason }
    | { readonly kind: 'reopen' }
    | { readonly kind: 'comment'; readonly body: string }
    | {
          readonly kind: 'projectField';
          /** The project item's id. */
          readonly projectItemId: string;
          readonly fieldId: string;
          /** `null` clears it. */
          readonly value: ProjectFieldInput | null;
      }
    | {
          /**
           * A field of every item's place in the project (several items selected): turned into `projectField` of
           * each item's own place; an item not in the project is reported as not editable.
           */
          readonly kind: 'projectFieldInProject';
          readonly projectId: string;
          readonly fieldId: string;
          /** `null` clears it. */
          readonly value: ProjectFieldInput | null;
      }
    | { readonly kind: 'addToProject'; readonly project: ViewerProject }
    | { readonly kind: 'requestReviewers'; readonly logins: readonly string[] }
    | { readonly kind: 'draft'; readonly draft: boolean };

/** A request as one item's edits are made of it: a project's field already resolved to the item's place there. */
export type ItemEditRequest = Exclude<EditRequest, { readonly kind: 'projectFieldInProject' }>;

/** A value set on a project field. */
export type ProjectFieldInput =
    | { readonly kind: 'singleSelect'; readonly optionId: string }
    | { readonly kind: 'iteration'; readonly iterationId: string }
    | { readonly kind: 'text'; readonly text: string }
    | { readonly kind: 'number'; readonly number: number }
    /** ISO date (`2026-10-30`). */
    | { readonly kind: 'date'; readonly date: string };

/** What an edit changes, as a toast or the status bar names it. */
export type EditSubject =
    | { readonly kind: 'labelAdded' | 'labelRemoved'; readonly label: string }
    | { readonly kind: 'assigneeAdded' | 'assigneeRemoved'; readonly login: string }
    | { readonly kind: 'milestone'; readonly title: string | null }
    | { readonly kind: 'issueType'; readonly name: string | null }
    | { readonly kind: 'closed'; readonly reason: CloseReason | null }
    | { readonly kind: 'reopened' }
    /** `body`: what the user wrote, put back into the comment box when GitHub does not take it. */
    | { readonly kind: 'comment'; readonly body: string }
    | { readonly kind: 'projectField'; readonly project: string; readonly field: string; readonly value: string | null }
    | { readonly kind: 'addedToProject'; readonly project: string }
    | { readonly kind: 'draftAdded'; readonly project: string; readonly title: string }
    /** An issue created in `repository` (`owner/name`). */
    | { readonly kind: 'issueCreated'; readonly repository: string; readonly title: string }
    /** Made a sub-issue of `parent` (`portal#1187`) as it was created. */
    | { readonly kind: 'subIssueOf'; readonly parent: string }
    | { readonly kind: 'reviewRequested'; readonly login: string }
    | { readonly kind: 'draft'; readonly draft: boolean };

/** Why GitHub did not take an edit. */
export type EditFailureReason =
    /** GitHub answered without the change: it silently drops what the user may not do (D14). */
    | { readonly kind: 'dropped' }
    /** The user may not make it here; it was never sent (an item of a selection). */
    | { readonly kind: 'notAllowed' }
    /** What it names — a label, a user, a milestone — is not in the item's repository (any more). */
    | { readonly kind: 'missing' }
    /** GitHub could not be reached. */
    | { readonly kind: 'offline' }
    /** GitHub answered with an error. */
    | { readonly kind: 'refused'; readonly message: string };

/** What GitHub's answer to an edit says. */
export type EditVerdict =
    /**
     * Done. `layer` holds the state GitHub answered with: it is written into the stores, and drawn over a sync
     * answer older than it that arrives after.
     */
    | {
          readonly kind: 'confirmed';
          readonly layer: ItemOverlayLayer;
          /**
           * What GitHub did not take of an edit that did several things at once (an issue created with labels it
           * dropped, D14): reported like failed edits, while the rest stays.
           */
          readonly partial?: EditPartialFailure;
      }
    | { readonly kind: 'rejected'; readonly reason: EditFailureReason };

/** The parts of a confirmed edit GitHub did not take. */
export interface EditPartialFailure {
    /** The item as GitHub names it now (an issue created under a temporary id). */
    readonly itemId: string;
    /** Its `owner/name#number` now. */
    readonly reference: string;
    readonly failed: readonly EditPartFailure[];
}

/** One part of a confirmed edit GitHub did not take, and why. */
export interface EditPartFailure {
    readonly subject: EditSubject;
    readonly reason: EditFailureReason;
}

/** One change of one item, sent to GitHub as one mutation (D8, D14). */
export interface Edit {
    /** The item's node id; a draft issue being added is drawn under a temporary one until GitHub names it. */
    readonly itemId: string;
    /** The item's `owner/name#number` (a draft's project), for the messages. */
    readonly reference: string;
    readonly subject: EditSubject;
    /** Drawn over the item at once and until GitHub answers. */
    readonly optimistic: ItemOverlayLayer;
    /**
     * Sends it and reads GitHub's answer; rejects when GitHub could not be reached or answered with an error. Not
     * there for an edit that cannot be sent at all (`failure` says why).
     */
    readonly send?: (sdk: GitHubSdk) => Promise<EditVerdict>;
    /** Why it fails without being sent. */
    readonly failure?: EditFailureReason;
}
