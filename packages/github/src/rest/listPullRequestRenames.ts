import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import { readNextPageUrl } from '../utils/readNextPageUrl.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** Which pull request to read. */
export interface ListPullRequestRenamesParams {
    /** `owner/name`. */
    nameWithOwner: string;
    number: number;
}

/**
 * Where a pull request's renamed and copied files came from, `path → previous path`, which GraphQL's
 * `PullRequestChangedFile` does not say. Reads `GET /repos/{o}/{r}/pulls/{n}/files` through every page: heavy, as
 * it carries the patches, so ask only for a pull request that has such a file.
 *
 * Throws {@link GitHubApiError} when GitHub refuses or an answer is not a list of files.
 */
export async function listPullRequestRenames(
    rest: GitHubRestRequester,
    params: ListPullRequestRenamesParams,
): Promise<Map<string, string>> {
    const renames = new Map<string, string>();
    let next: string | undefined = `${getRepositoryRestPath(params.nameWithOwner)}/pulls/${params.number}/files`;
    let query: Record<string, string> | undefined = { per_page: '100' };
    while (next !== undefined) {
        const page = await rest({ url: next, query });
        if (!Array.isArray(page.payload)) {
            throw new GitHubApiError({ status: page.status, message: 'GitHub pull request files answer is malformed' });
        }

        for (const file of page.payload) {
            if (
                isPlainObject(file) &&
                typeof file.filename === 'string' &&
                typeof file.previous_filename === 'string'
            ) {
                renames.set(file.filename, file.previous_filename);
            }
        }

        // The URL GitHub hands out already says everything.
        next = readNextPageUrl(page.headers);
        query = undefined;
    }

    return renames;
}
