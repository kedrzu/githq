import type { CommitPullRequest } from '@githq/github/readCommitPullRequests.js';

/**
 * The pull requests in a submodule's repository a review shows for its new pointer: the open ones (drafts too), which
 * are usually what to review or merge first; with none open, the merged ones. A closed one never.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function selectSubmodulePullRequests(pullRequests: readonly CommitPullRequest[]): CommitPullRequest[] {
    const open = pullRequests.filter(pullRequest => pullRequest.state === 'OPEN');
    return open.length > 0 ? open : pullRequests.filter(pullRequest => pullRequest.state === 'MERGED');
}
