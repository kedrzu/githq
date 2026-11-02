import type { GitHubRestRequester } from './createGitHubRestRequester.js';
import { sendAsyncMergeRequest } from './sendAsyncMergeRequest.js';
import type { AsyncMergeAnswer } from './sendAsyncMergeRequest.js';

/** The merge of one pull request to ask GitHub for. */
export interface RequestAsyncMergeParams {
    /** The repository's owner. */
    readonly owner: string;
    /** The repository's name. */
    readonly name: string;
    /** The pull request's number. */
    readonly number: number;
    readonly mergeMethod: 'merge' | 'squash' | 'rebase';
    /** The head commit the merge was decided on: GitHub refuses it (`failed`) when the head moved since. */
    readonly sha: string;
    /** The commit's title; GitHub's default when not given. */
    readonly commitTitle?: string;
    /** The commit's message; GitHub's default when not given. */
    readonly commitMessage?: string;
}

/**
 * Asks GitHub to merge a pull request (`PUT …/pulls/{number}/merge-async`). GitHub enqueues the merge and answers
 * `pending` with the `uuid` to follow it by (`readAsyncMerge`); a pull request already merged answers `merged`, a
 * refused merge `failed`. Throws `GitHubApiError` on any other refusal.
 */
export function requestAsyncMerge(
    rest: GitHubRestRequester,
    params: RequestAsyncMergeParams,
): Promise<AsyncMergeAnswer> {
    const { owner, name, number, mergeMethod, sha, commitTitle, commitMessage } = params;
    return sendAsyncMergeRequest(rest, {
        method: 'PUT',
        url: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${number}/merge-async`,
        body: {
            merge_method: mergeMethod,
            sha,
            ...(commitTitle === undefined ? {} : { commit_title: commitTitle }),
            ...(commitMessage === undefined ? {} : { commit_message: commitMessage }),
        },
    });
}
