import type { GitHubSdk } from './createGitHubRequester.js';
import type { CommitSubjectsQuery } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';

/** Which commits to read. */
export interface ListCommitSubjectsParams {
    readonly owner: string;
    readonly name: string;
    /** The commit or branch to read back from. */
    readonly from: string;
    /** The commits to stop at, without listing them. */
    readonly stopAt: ReadonlySet<string>;
    /** How many pages of 100 to read at most. */
    readonly maxPages: number;
}

/** The commits read. */
export interface ListCommitSubjectsResult {
    /** The first line of each message, newest first. */
    readonly subjects: string[];
    /** The commit of `stopAt` the walk met; `null` when it met none. */
    readonly stoppedAt: string | null;
    /** The pages allowed ran out with more commits behind them. */
    readonly limited: boolean;
}

/**
 * Reads the subjects of the commits behind `from` (`CommitSubjects`), newest first, up to the first commit of `stopAt`.
 * Paged, rather than compared, because a comparison lists at most 250 commits (desktop releases D17).
 *
 * Throws {@link GitHubApiError} when GitHub refuses, or has no such commit.
 */
export async function listCommitSubjects(
    sdk: GitHubSdk,
    { owner, name, from, stopAt, maxPages }: ListCommitSubjectsParams,
): Promise<ListCommitSubjectsResult> {
    const subjects: string[] = [];
    let after: string | null = null;

    for (let page = 0; page < maxPages; page++) {
        const { repository }: CommitSubjectsQuery = await sdk.CommitSubjects({ owner, name, from, after });
        const commit = repository?.object;
        if (!commit || !('history' in commit)) {
            throw new GitHubApiError({ status: 404, message: `GitHub has no commit ${from} in ${owner}/${name}` });
        }

        const { nodes, pageInfo } = commit.history;
        for (const node of nodes ?? []) {
            if (node && stopAt.has(node.oid)) {
                return { subjects, stoppedAt: node.oid, limited: false };
            }

            if (node) {
                subjects.push(node.message.split('\n', 1).join(''));
            }
        }

        if (!pageInfo.hasNextPage) {
            return { subjects, stoppedAt: null, limited: false };
        }

        after = pageInfo.endCursor;
    }

    return { subjects, stoppedAt: null, limited: true };
}
