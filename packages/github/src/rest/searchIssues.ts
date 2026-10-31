import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** A search of issues and pull requests; `q` is GitHub's search syntax, e.g. `is:open is:pr author:@me`. */
export interface SearchIssuesParams {
    q: string;
    /** At most 100, GitHub's cap; only the first page is read. */
    perPage?: number;
    sort?: 'updated' | 'created' | 'comments';
}

/** The first page of a search: enough to tell which items are in it and which changed since the last look. */
export interface SearchIssuesResult {
    /** All matches, beyond this page too. */
    totalCount: number;
    /** GitHub ran out of time and the matches may be partial. */
    incompleteResults: boolean;
    items: SearchIssuesItem[];
}

/** One issue or pull request a search found. */
export interface SearchIssuesItem {
    /** The GraphQL node id, for `ItemsByIds`. */
    nodeId: string;
    updatedAt: string;
    isPullRequest: boolean;
    number: number;
    /** `owner/name`. */
    repositoryFullName: string;
}

const REPOSITORY_URL_PATTERN = /\/repos\/([^/]+\/[^/]+)$/;

/**
 * Searches issues and pull requests (`GET /search/issues`), newest change first by default. Search answers
 * carry no ETag, so every call costs one request of the `search` bucket (30 a minute), not of `core`.
 * Throws {@link GitHubApiError} when the answer is not a search result.
 */
export async function searchIssues(rest: GitHubRestRequester, params: SearchIssuesParams): Promise<SearchIssuesResult> {
    const { q, perPage = 100, sort = 'updated' } = params;
    const answer = await rest({
        url: '/search/issues',
        query: { q, per_page: String(perPage), sort, order: 'desc' },
    });

    const result = readSearchResult(answer.payload);
    if (!result) {
        throw new GitHubApiError({ status: answer.status, message: 'GitHub search answer is malformed' });
    }

    return result;
}

function readSearchResult(payload: unknown): SearchIssuesResult | undefined {
    if (
        !isPlainObject(payload) ||
        typeof payload.total_count !== 'number' ||
        typeof payload.incomplete_results !== 'boolean' ||
        !Array.isArray(payload.items)
    ) {
        return undefined;
    }

    const items: SearchIssuesItem[] = [];
    for (const entry of payload.items) {
        const item = readSearchItem(entry);
        if (!item) {
            return undefined;
        }

        items.push(item);
    }

    return { totalCount: payload.total_count, incompleteResults: payload.incomplete_results, items };
}

function readSearchItem(entry: unknown): SearchIssuesItem | undefined {
    if (
        !isPlainObject(entry) ||
        typeof entry.node_id !== 'string' ||
        typeof entry.updated_at !== 'string' ||
        typeof entry.number !== 'number' ||
        typeof entry.repository_url !== 'string'
    ) {
        return undefined;
    }

    // `https://api.github.com/repos/{owner}/{name}` — a search hit names its repository only by this URL.
    const repositoryFullName = REPOSITORY_URL_PATTERN.exec(entry.repository_url)?.[1];
    if (!repositoryFullName) {
        return undefined;
    }

    return {
        nodeId: entry.node_id,
        updatedAt: entry.updated_at,
        // Search returns pull requests as issues; only theirs carry a `pull_request` object.
        isPullRequest: isPlainObject(entry.pull_request),
        number: entry.number,
        repositoryFullName,
    };
}
