import { GITHUB_REST_URL } from '../GitHubApi.js';
import { sendGitHubRequest } from '../sendGitHubRequest.js';
import type { GitHubAnswer, GitHubRequesterOptions } from '../sendGitHubRequest.js';

/** One request of GitHub's REST API, a `GET` unless it says otherwise. */
export interface GitHubRestRequest {
    method?: 'GET' | 'POST' | 'PUT';
    /** A path under `https://api.github.com` (`/search/issues`), or a full URL GitHub handed out. */
    url: string;
    /** Query parameters, appended to the URL. */
    query?: Record<string, string>;
    /** The ETag of the copy already held: GitHub answers 304, free of quota, when nothing changed. */
    etag?: string;
    /** Sent as JSON. */
    body?: unknown;
}

/** Sends one REST request; made by {@link createGitHubRestRequester}. */
export type GitHubRestRequester = (request: GitHubRestRequest) => Promise<GitHubAnswer>;

/**
 * Builds the requester GitHub's REST calls (`searchIssues`, `conditionalGet`, the settings repository's) go through. It fails and
 * reports rate limits exactly like the GraphQL requester: {@link GitHubApiError} on an answer that is
 * neither 2xx nor 304, every answer's bucket to `onRateLimit`.
 * @__NO_SIDE_EFFECTS__
 */
export function createGitHubRestRequester(options: GitHubRequesterOptions): GitHubRestRequester {
    return function request({ method = 'GET', url, query, etag, body }) {
        const target = new URL(url, GITHUB_REST_URL);
        for (const [name, value] of Object.entries(query ?? {})) {
            target.searchParams.set(name, value);
        }

        const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
        if (etag != null) {
            headers['If-None-Match'] = etag;
        }

        if (body === undefined) {
            return sendGitHubRequest(options, { url: target.toString(), method, headers });
        }

        headers['Content-Type'] = 'application/json';
        return sendGitHubRequest(options, { url: target.toString(), method, headers, body: JSON.stringify(body) });
    };
}
