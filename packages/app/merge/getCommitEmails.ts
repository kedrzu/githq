import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';

import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

/** The addresses GitHub says the viewer may commit a merge with. */
export type ViewerCommitEmails = Pick<RepositoryMetadata, 'viewerDefaultCommitEmail' | 'viewerPossibleCommitEmails'>;

/** What {@link getCommitEmails} decides from. */
export interface GetCommitEmailsParams {
    readonly emails: ViewerCommitEmails | null | undefined;
    readonly method: PullRequestMergeMethod | null;
    readonly pr: Pick<PullRequestItem, 'author' | 'isMergeQueueEnabled' | 'stack'>;
    readonly viewerLogin: string | null | undefined;
}

/**
 * The addresses to choose the merge's commit email from, the viewer's default first (merging D4, PM6); `null` where
 * there is no choice: a rebase makes no commit of its own, a squash takes one only from the pull request's author, and
 * a queue writes its own commits. Nor in a stack: the email goes through `mergePullRequest`, which "does not support
 * stacked pull requests". Without a default GitHub names, nothing says which one the merge would start on.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getCommitEmails(params: GetCommitEmailsParams): readonly string[] | null {
    const { emails, method, pr, viewerLogin } = params;
    const start = emails?.viewerDefaultCommitEmail;
    if (!start || method === null || method === 'REBASE' || pr.isMergeQueueEnabled || pr.stack) {
        return null;
    }

    if (method === 'SQUASH' && (!viewerLogin || pr.author?.login !== viewerLogin)) {
        return null;
    }

    const others = (emails?.viewerPossibleCommitEmails ?? []).filter(email => email !== start);
    return others.length > 0 ? [start, ...others] : null;
}
