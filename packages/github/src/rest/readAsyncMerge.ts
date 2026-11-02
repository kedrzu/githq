import type { GitHubRestRequester } from './createGitHubRestRequester.js';
import { sendAsyncMergeRequest } from './sendAsyncMergeRequest.js';
import type { AsyncMergeAnswer } from './sendAsyncMergeRequest.js';

/** The merge `requestAsyncMerge` enqueued, to ask about. */
export interface ReadAsyncMergeParams {
    /** The repository's owner. */
    readonly owner: string;
    /** The repository's name. */
    readonly name: string;
    /** The pull request's number. */
    readonly number: number;
    /** What `requestAsyncMerge` answered `pending` with. */
    readonly uuid: string;
}

/**
 * Where an enqueued merge stands (`GET …/pulls/{number}/merge-async/{uuid}`): still `pending`, `merged` or
 * `failed`. Throws `GitHubApiError` on any other refusal — 404 for a `uuid` GitHub does not know.
 */
export function readAsyncMerge(rest: GitHubRestRequester, params: ReadAsyncMergeParams): Promise<AsyncMergeAnswer> {
    const { owner, name, number, uuid } = params;
    return sendAsyncMergeRequest(rest, {
        url: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${number}/merge-async/${encodeURIComponent(uuid)}`,
    });
}
