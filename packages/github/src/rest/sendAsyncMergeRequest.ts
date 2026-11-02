import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import type { GitHubRestRequest, GitHubRestRequester } from './createGitHubRestRequester.js';

/**
 * Where an asynchronous merge stands (`merge-async`): enqueued or still running (ask again by `uuid`), done (`sha`
 * of the commit it made on the base branch, or of the merge GitHub had already made), or refused with GitHub's own
 * words — a moved head, a failing requirement, a conflict.
 */
export type AsyncMergeAnswer =
    | { readonly status: 'pending'; readonly uuid: string }
    | { readonly status: 'merged'; readonly sha: string }
    | { readonly status: 'failed'; readonly message: string };

/**
 * Sends a request of the `merge-async` endpoints and reads where the merge stands. GitHub answers a refusal with
 * a 4xx whose body is a `failed` answer (400 for a moved head): that comes back as the `failed` answer, not as a
 * throw. Throws {@link GitHubApiError} on any other refusal (404 for an unknown `uuid`) and on an answer it cannot
 * read — an unknown `status` too, rather than guessing what it means.
 */
export async function sendAsyncMergeRequest(
    rest: GitHubRestRequester,
    request: GitHubRestRequest,
): Promise<AsyncMergeAnswer> {
    let answer;
    try {
        answer = await rest(request);
    } catch (error) {
        const refusal = error instanceof GitHubApiError ? readAnswer(error.body) : undefined;
        if (refusal?.status === 'failed') {
            return refusal;
        }

        throw error;
    }

    const read = readAnswer(answer.payload);
    if (!read) {
        throw new GitHubApiError({ status: answer.status, message: 'GitHub merge answer is malformed' });
    }

    return read;
}

function readAnswer(payload: unknown): AsyncMergeAnswer | undefined {
    if (!isPlainObject(payload) || !isPlainObject(payload.details)) {
        return undefined;
    }

    const { status, details } = payload;
    switch (status) {
        case 'pending':
            return typeof details.uuid === 'string' ? { status, uuid: details.uuid } : undefined;
        case 'merged':
            return typeof details.sha === 'string' ? { status, sha: details.sha } : undefined;
        case 'failed':
            return typeof details.message === 'string' ? { status, message: details.message } : undefined;
        default:
            return undefined;
    }
}
