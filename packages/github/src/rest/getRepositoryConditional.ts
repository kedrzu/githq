import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import { conditionalGet } from './conditionalGet.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** Which repository to look at, and the ETag of the last answer. */
export interface GetRepositoryConditionalParams {
    /** `owner/name`. */
    nameWithOwner: string;
    /** The ETag the last 200 returned; GitHub answers 304, free of quota, while nothing changed. */
    etag?: string;
}

/** Nothing changed since the ETag (free), or the repository changed, with the ETag to send next time. */
export type GetRepositoryConditionalResult =
    | { status: 304 }
    | {
          status: 200;
          /** `undefined` when GitHub sent none — the next call cannot be conditional. */
          etag: string | undefined;
          /** The branch GitHub currently calls the default one, so a rename follows by itself (actions D5). */
          defaultBranch: string;
      };

/**
 * `GET`s a repository over REST with `If-None-Match` (`/repos/{o}/{r}`) for its default branch; a 304 is free of
 * quota.
 *
 * Throws {@link GitHubApiError} when GitHub refuses (a 404: the repository is gone, or hidden from the token) and
 * when the answer is not a repository.
 */
export async function getRepositoryConditional(
    rest: GitHubRestRequester,
    params: GetRepositoryConditionalParams,
): Promise<GetRepositoryConditionalResult> {
    const answer = await conditionalGet(rest, { url: getRepositoryRestPath(params.nameWithOwner), etag: params.etag });
    if (answer.status === 304) {
        return answer;
    }

    const { body } = answer;
    if (!isPlainObject(body) || typeof body.default_branch !== 'string') {
        throw new GitHubApiError({ status: answer.status, message: 'GitHub repository answer is malformed' });
    }

    return { status: 200, etag: answer.etag, defaultBranch: body.default_branch };
}
