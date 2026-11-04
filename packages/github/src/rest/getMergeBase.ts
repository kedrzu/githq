import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** Which two commits to find the merge base of. */
export interface GetMergeBaseParams {
    /** `owner/name`. */
    nameWithOwner: string;
    baseOid: string;
    headOid: string;
}

/**
 * The commit `baseOid` and `headOid` forked from — what a pull request's diff is taken against, not its base
 * branch's tip. GraphQL has no such field, so this asks `GET /repos/{o}/{r}/compare/{base}...{head}`, for page 2 of
 * one: `merge_base_commit` comes with every page, and the first also carries up to 300 files with their patches.
 *
 * Throws {@link GitHubApiError} when GitHub refuses or the answer has no merge base.
 */
export async function getMergeBase(rest: GitHubRestRequester, params: GetMergeBaseParams): Promise<string> {
    const { status, payload } = await rest({
        url: `${getRepositoryRestPath(params.nameWithOwner)}/compare/${params.baseOid}...${params.headOid}`,
        query: { per_page: '1', page: '2' },
    });

    const commit = isPlainObject(payload) ? payload.merge_base_commit : null;
    if (!isPlainObject(commit) || typeof commit.sha !== 'string') {
        throw new GitHubApiError({ status, message: 'GitHub compare answer has no merge base' });
    }

    return commit.sha;
}
