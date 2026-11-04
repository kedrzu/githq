import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** Which repository's tags to list, and the ETag of the last answer. */
export interface ListRepositoryTagsParams {
    /** `owner/name`. */
    nameWithOwner: string;
    /** The ETag the last 200 returned; GitHub answers 304, free of quota, while no tag changed. */
    etag?: string;
}

/** No tag changed since the ETag (free), or every tag of the repository. */
export type ListRepositoryTagsResult =
    | { status: 304 }
    | {
          status: 200;
          /** `undefined` when GitHub sent none — the next call cannot be conditional. */
          etag: string | undefined;
          /** The tags' names, `v1.0` for `refs/tags/v1.0`. */
          tags: string[];
      };

const TAG_PREFIX = 'refs/tags/';

/**
 * Lists the names of a repository's tags (`GET /repos/{o}/{r}/git/matching-refs/tags`) with `If-None-Match`, so a
 * run's ref can be told a tag from a branch (actions D13): a run names only its ref. This endpoint and not `/tags`:
 * it answers every tag in one unpaged answer of about 300 bytes a tag (972 for nodejs/node, checked 2026-11-02),
 * where `/tags` pages by 100 in an order that is not by creation, so a recent tag could need many pages. An empty
 * repository, which GitHub answers 409, has no tags.
 *
 * Throws {@link GitHubApiError} when GitHub refuses otherwise or the answer is not a list of refs.
 */
export async function listRepositoryTags(
    rest: GitHubRestRequester,
    params: ListRepositoryTagsParams,
): Promise<ListRepositoryTagsResult> {
    let answer;
    try {
        answer = await rest({
            url: `${getRepositoryRestPath(params.nameWithOwner)}/git/matching-refs/tags`,
            etag: params.etag,
        });
    } catch (error) {
        if (error instanceof GitHubApiError && error.status === 409) {
            return { status: 200, etag: undefined, tags: [] };
        }

        throw error;
    }

    if (answer.status === 304) {
        return { status: 304 };
    }

    if (!Array.isArray(answer.payload)) {
        throw malformed(answer.status);
    }

    const tags: string[] = [];
    for (const entry of answer.payload) {
        if (!isPlainObject(entry) || typeof entry.ref !== 'string' || !entry.ref.startsWith(TAG_PREFIX)) {
            throw malformed(answer.status);
        }

        tags.push(entry.ref.slice(TAG_PREFIX.length));
    }

    return { status: 200, etag: answer.headers.get('etag') ?? undefined, tags };
}

function malformed(status: number) {
    return new GitHubApiError({ status, message: 'GitHub tag list answer is malformed' });
}
