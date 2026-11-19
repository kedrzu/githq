import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';

import type { PullRequestItem } from '@/store/ItemTypes.js';

import type { MergeSettings } from './getMergeMethods.js';

/** What {@link getCommitEmails} decides from. */
export interface GetCommitEmailsParams {
    /** The addresses GitHub says the viewer may commit a merge with; `null` until the repository's metadata is known. */
    readonly settings: Pick<MergeSettings, 'viewerDefaultCommitEmail' | 'viewerPossibleCommitEmails'> | null;
    readonly method: PullRequestMergeMethod | null;
    readonly pr: Pick<PullRequestItem, 'author' | 'isMergeQueueEnabled' | 'stack'>;
    readonly viewerLogin: string | null | undefined;
    /** The address the merge starts on (`resolveCommitEmail`): listed first when it isn't GitHub's default. */
    readonly resolved?: string | null;
}

/**
 * The addresses to choose the merge's commit email from (merging D4, PM48): the resolved one when it isn't GitHub's
 * default, then GitHub's default, then the others in GitHub's order; `null` where
 * there is no choice: a rebase makes no commit of its own, a squash takes one only from the pull request's author, and
 * a queue writes its own commits. Nor in a stack: the email goes through `mergePullRequest`, which "does not support
 * stacked pull requests". Without a default GitHub names, nothing says which one the merge would start on.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getCommitEmails(params: GetCommitEmailsParams): readonly string[] | null {
    const { settings, method, pr, viewerLogin, resolved } = params;
    const start = settings?.viewerDefaultCommitEmail;
    if (!start || method === null || method === 'REBASE' || pr.isMergeQueueEnabled || pr.stack) {
        return null;
    }

    if (method === 'SQUASH' && (!viewerLogin || pr.author?.login !== viewerLogin)) {
        return null;
    }

    const possible = settings?.viewerPossibleCommitEmails ?? [];
    const others = possible.filter(email => email !== start);
    if (others.length === 0) {
        return null;
    }

    const first = resolved && resolved !== start && possible.includes(resolved) ? resolved : null;
    return first === null ? [start, ...others] : [first, start, ...others.filter(email => email !== first)];
}
