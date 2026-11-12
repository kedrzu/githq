import type { GitHubSdk } from './createGitHubRequester.js';
import type { CommitPullRequestsQuery, PullRequestState } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';

/** A pull request that carries a commit. */
export interface CommitPullRequest {
    readonly number: number;
    readonly state: PullRequestState;
    readonly title: string;
    readonly url: string;
    readonly isDraft: boolean;
}

/** Whose pull requests to read. */
export interface ReadCommitPullRequestsParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly oid: string;
}

/**
 * Reads the pull requests that carry a commit (`CommitPullRequests`), the first 10: the merged one that brought it to
 * the default branch, or, while it is not there, the open ones that hold it.
 *
 * Throws {@link GitHubApiError} when GitHub refuses, or has no such commit.
 */
export async function readCommitPullRequests(
    sdk: GitHubSdk,
    { nameWithOwner, oid }: ReadCommitPullRequestsParams,
): Promise<CommitPullRequest[]> {
    const [owner = '', name = ''] = nameWithOwner.split('/');
    const { repository }: CommitPullRequestsQuery = await sdk.CommitPullRequests({ owner, name, oid });
    const commit = repository?.object;
    if (!commit || !('associatedPullRequests' in commit)) {
        throw new GitHubApiError({ status: 404, message: `GitHub has no commit ${oid} in ${nameWithOwner}` });
    }

    const pullRequests: CommitPullRequest[] = [];
    for (const node of commit.associatedPullRequests?.nodes ?? []) {
        if (node) {
            pullRequests.push(node);
        }
    }

    return pullRequests;
}
