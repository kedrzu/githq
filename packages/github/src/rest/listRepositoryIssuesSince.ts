import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { readNextPageUrl } from '../utils/readNextPageUrl.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** Which repository to look at, since when, and the ETag of the last answer. */
export interface ListRepositoryIssuesSinceParams {
    owner: string;
    name: string;
    /** An ISO timestamp: only issues and pull requests updated at or after it are listed. */
    since: string;
    /** The ETag the last 200 returned; GitHub answers 304, free of quota, while nothing changed. */
    etag?: string;
}

/** Nothing changed since the ETag (free), or the issues and pull requests updated since `since`. */
export type ListRepositoryIssuesSinceResult =
    | { status: 304 }
    | {
          status: 200;
          /** The first page's ETag, for the next call; `undefined` when GitHub sent none. */
          etag: string | undefined;
          /** Every page's hits, the most recently updated first. */
          items: RepositoryIssueChange[];
      };

/** One issue or pull request the list found updated. */
export interface RepositoryIssueChange {
    /** The GraphQL node id, for `ItemsByIds`. */
    nodeId: string;
    number: number;
    updatedAt: string;
    isPullRequest: boolean;
}

/**
 * Lists a tracked repository's issues and pull requests updated since `since` (`GET /repos/{o}/{r}/issues`,
 * newest change first) — the repository loop's change signal (D7). The first page goes with `If-None-Match`:
 * a 304 is free of quota and ends the call. On a 200 the pages after it follow the `Link` header, and the
 * ETag kept is the first page's: any change moves its item to the top of the first page, so that page alone
 * tells whether anything changed.
 *
 * The ETag is a hash of the answer's body, not of the URL: every empty answer has the same one, so a caller
 * may move `since` forward between calls and still get a 304 while nothing changes.
 *
 * Throws {@link GitHubApiError} when an answer is not a list of issues.
 */
export async function listRepositoryIssuesSince(
    rest: GitHubRestRequester,
    params: ListRepositoryIssuesSinceParams,
): Promise<ListRepositoryIssuesSinceResult> {
    const { owner, name, since, etag } = params;
    const first = await rest({
        url: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues`,
        query: { state: 'all', since, per_page: '100', sort: 'updated', direction: 'desc' },
        etag,
    });
    if (first.status === 304) {
        return { status: 304 };
    }

    const items = readIssueChanges(first.status, first.payload);
    let next = readNextPageUrl(first.headers);
    while (next !== undefined) {
        const page = await rest({ url: next });
        items.push(...readIssueChanges(page.status, page.payload));
        next = readNextPageUrl(page.headers);
    }

    return { status: 200, etag: first.headers.get('etag') ?? undefined, items };
}

function readIssueChanges(status: number, payload: unknown) {
    if (!Array.isArray(payload)) {
        throw new GitHubApiError({ status, message: 'GitHub issue list answer is malformed' });
    }

    const items: RepositoryIssueChange[] = [];
    for (const entry of payload) {
        if (
            !isPlainObject(entry) ||
            typeof entry.node_id !== 'string' ||
            typeof entry.number !== 'number' ||
            typeof entry.updated_at !== 'string'
        ) {
            throw new GitHubApiError({ status, message: 'GitHub issue list answer is malformed' });
        }

        items.push({
            nodeId: entry.node_id,
            number: entry.number,
            updatedAt: entry.updated_at,
            // The issues list returns pull requests as issues; only theirs carry a `pull_request` object.
            isPullRequest: isPlainObject(entry.pull_request),
        });
    }

    return items;
}
