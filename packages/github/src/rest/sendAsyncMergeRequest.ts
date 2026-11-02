import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import type { GitHubRestRequest, GitHubRestRequester } from './createGitHubRestRequester.js';

/**
 * Where an asynchronous merge stands (`merge-async`): still running (ask again by `uuid`), put in the base branch's
 * merge queue (`enqueued`: no `uuid`, the queue goes on by itself), done (`sha` of the commit it made on the base
 * branch, or of the merge GitHub had already made), or refused with GitHub's own words — a moved head, a failing
 * requirement, a conflict.
 */
export type AsyncMergeAnswer =
    | { readonly status: 'pending'; readonly uuid: string }
    | { readonly status: 'enqueued' }
    | { readonly status: 'merged'; readonly sha: string }
    | { readonly status: 'failed'; readonly message: string };

/**
 * Sends a request of the `merge-async` endpoints and reads where the merge stands. GitHub may answer with a 4xx whose
 * body is still an answer — `failed` (400 for a moved head), `pending` (409 for a merge already running): that comes
 * back as the answer, not as a throw. Throws {@link GitHubApiError} on any other refusal (404 for an unknown `uuid`)
 * and on an answer it cannot read — an unknown `status` too, rather than guessing what it means.
 */
export async function sendAsyncMergeRequest(
    rest: GitHubRestRequester,
    request: GitHubRestRequest,
): Promise<AsyncMergeAnswer> {
    let answer;
    try {
        answer = await rest(request);
    } catch (error) {
        const read = error instanceof GitHubApiError ? readAnswer(error.body) : undefined;
        if (read) {
            return read;
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
    if (!isPlainObject(payload)) {
        return undefined;
    }

    const { status, details } = payload;
    if (status === 'enqueued') {
        return { status };
    }

    if (!isPlainObject(details)) {
        return undefined;
    }

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
