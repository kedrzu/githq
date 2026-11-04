import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** GitHub's answer for a ref it doesn't know: 404, or 422 "No commit found". */
const UNKNOWN_REF = [404, 422];

/**
 * The commit a tag stands on (`GET /repos/{o}/{r}/commits/{tag}`), an annotated tag's too; `null` when the repository has
 * no such tag.
 *
 * Throws {@link GitHubApiError} when GitHub refuses otherwise, or the answer is not a commit.
 */
export async function getTagCommit(rest: GitHubRestRequester, nameWithOwner: string, tag: string) {
    let answer;
    try {
        answer = await rest({ url: `${getRepositoryRestPath(nameWithOwner)}/commits/${encodeURIComponent(tag)}` });
    } catch (error) {
        if (error instanceof GitHubApiError && UNKNOWN_REF.includes(error.status)) {
            return null;
        }

        throw error;
    }

    if (!isPlainObject(answer.payload) || typeof answer.payload.sha !== 'string') {
        throw new GitHubApiError({ status: answer.status, message: 'GitHub commit answer is malformed' });
    }

    return answer.payload.sha;
}
