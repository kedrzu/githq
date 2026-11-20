import type { GitHubSdk } from './createGitHubRequester.js';
import type { CommitsQuery } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';

/** Which commits to read. */
export interface ListCommitsParams {
    readonly owner: string;
    readonly name: string;
    /** The commit or branch to read back from. */
    readonly from: string;
    /** The commits to stop at, without listing them. */
    readonly stopAt: ReadonlySet<string>;
    /** How many pages of 100 to read at most. */
    readonly maxPages: number;
}

/** A commit read: the first line of its message, and who wrote it. */
export interface ListedCommit {
    readonly subject: string;
    /** The GitHub login of its author; `null` when GitHub links the commit to no account. */
    readonly author: string | null;
}

/** The commits read. */
export interface ListCommitsResult {
    /** Newest first. */
    readonly commits: ListedCommit[];
    /** The commit of `stopAt` the walk met; `null` when it met none. */
    readonly stoppedAt: string | null;
    /** The pages allowed ran out with more commits behind them. */
    readonly limited: boolean;
}

/**
 * Reads the commits behind `from` (`Commits`), newest first, up to the first commit of `stopAt`.
 * Paged, rather than compared, because a comparison lists at most 250 commits (desktop releases D17).
 *
 * Throws {@link GitHubApiError} when GitHub refuses, or has no such commit.
 */
export async function listCommits(
    sdk: GitHubSdk,
    { owner, name, from, stopAt, maxPages }: ListCommitsParams,
): Promise<ListCommitsResult> {
    const commits: ListedCommit[] = [];
    let after: string | null = null;

    for (let page = 0; page < maxPages; page++) {
        const { repository }: CommitsQuery = await sdk.Commits({ owner, name, from, after });
        const commit = repository?.object;
        if (!commit || !('history' in commit)) {
            throw new GitHubApiError({ status: 404, message: `GitHub has no commit ${from} in ${owner}/${name}` });
        }

        const { nodes, pageInfo } = commit.history;
        for (const node of nodes ?? []) {
            if (node && stopAt.has(node.oid)) {
                return { commits, stoppedAt: node.oid, limited: false };
            }

            if (node) {
                commits.push({
                    subject: node.message.split('\n', 1).join(''),
                    author: node.author?.user?.login ?? null,
                });
            }
        }

        if (!pageInfo.hasNextPage) {
            return { commits, stoppedAt: null, limited: false };
        }

        after = pageInfo.endCursor;
    }

    return { commits, stoppedAt: null, limited: true };
}
