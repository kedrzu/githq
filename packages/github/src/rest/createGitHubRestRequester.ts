import { GITHUB_REST_URL } from '../GitHubApi.js';
import { sendGitHubRequest } from '../sendGitHubRequest.js';
import type { GitHubAnswer, GitHubRequesterOptions } from '../sendGitHubRequest.js';

/** One `GET` of GitHub's REST API. */
export interface GitHubRestRequest {
    /** A path under `https://api.github.com` (`/search/issues`), or a full URL GitHub handed out. */
    url: string;
    /** Query parameters, appended to the URL. */
    query?: Record<string, string>;
    /** The ETag of the copy already held: GitHub answers 304, free of quota, when nothing changed. */
    etag?: string;
}

/** Sends one REST `GET`; made by {@link createGitHubRestRequester}. */
export type GitHubRestRequester = (request: GitHubRestRequest) => Promise<GitHubAnswer>;

/**
 * Builds the requester GitHub's REST calls (`searchIssues`, `conditionalGet`) go through. It fails and
 * reports rate limits exactly like the GraphQL requester: {@link GitHubApiError} on an answer that is
 * neither 2xx nor 304, every answer's bucket to `onRateLimit`.
 * @__NO_SIDE_EFFECTS__
 */
export function createGitHubRestRequester(options: GitHubRequesterOptions): GitHubRestRequester {
    return function request({ url, query, etag }) {
        const target = new URL(url, GITHUB_REST_URL);
        for (const [name, value] of Object.entries(query ?? {})) {
            target.searchParams.set(name, value);
        }

        const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
        if (etag != null) {
            headers['If-None-Match'] = etag;
        }

        return sendGitHubRequest(options, { url: target.toString(), method: 'GET', headers });
    };
}
