import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import { readNextPageUrl } from '../utils/readNextPageUrl.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** Which commits to read. */
export interface ListCommitSubjectsParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    /** The commit or branch to read back from. */
    readonly from: string;
    /** The commit to stop before; `null` when there is none, and the pages run out first. */
    readonly until: string | null;
    /** How many pages of 100 to read at most. */
    readonly maxPages: number;
}

/** The commits read. */
export interface ListCommitSubjectsResult {
    /** The first line of each message, newest first. */
    readonly subjects: string[];
    /** The pages allowed ran out with more commits behind them. */
    readonly limited: boolean;
}

const PAGE_SIZE = 100;

/**
 * Reads the subjects of the commits behind `from` (`GET /repos/{o}/{r}/commits`), newest first, up to `until` and without
 * it. Paged, rather than compared, because a comparison lists at most 250 commits (desktop releases D17).
 *
 * Throws {@link GitHubApiError} when GitHub refuses, or the answer is not a list of commits.
 */
export async function listCommitSubjects(
    rest: GitHubRestRequester,
    { nameWithOwner, from, until, maxPages }: ListCommitSubjectsParams,
): Promise<ListCommitSubjectsResult> {
    const subjects: string[] = [];
    let url: string | undefined = `${getRepositoryRestPath(nameWithOwner)}/commits`;
    let query: Record<string, string> | undefined = { sha: from, per_page: String(PAGE_SIZE) };

    for (let page = 0; page < maxPages && url !== undefined; page++) {
        const answer = await rest({ url, query });
        if (!Array.isArray(answer.payload)) {
            throw malformed(answer.status);
        }

        for (const entry of answer.payload) {
            if (!isPlainObject(entry) || typeof entry.sha !== 'string' || !isPlainObject(entry.commit)) {
                throw malformed(answer.status);
            }

            if (entry.sha === until) {
                return { subjects, limited: false };
            }

            const { message } = entry.commit;
            if (typeof message !== 'string') {
                throw malformed(answer.status);
            }

            subjects.push(message.split('\n', 1).join(''));
        }

        url = readNextPageUrl(answer.headers);
        query = undefined;
    }

    return { subjects, limited: url !== undefined };
}

function malformed(status: number) {
    return new GitHubApiError({ status, message: 'GitHub commit list answer is malformed' });
}
