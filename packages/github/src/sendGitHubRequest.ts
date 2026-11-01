import type { Fetch } from '@nzyme/types/Fetch.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from './GitHubApiError.js';
import type { GitHubRateLimit } from './GitHubRateLimit.js';
import { parseJson } from './utils/parseJson.js';
import { readGitHubErrors } from './utils/readGitHubErrors.js';

/** Configuration shared by the GraphQL and the REST requester. */
export interface GitHubRequesterOptions {
    /** Returns the user's OAuth token; asked before every request, so a refreshed token is picked up. */
    getToken: () => string | Promise<string>;
    /** Request transport; defaults to `globalThis.fetch`. */
    fetch?: Fetch;
    /** Receives the rate-limit bucket reported by every GitHub answer that carries it, errors included. */
    onRateLimit?: (rateLimit: GitHubRateLimit) => void;
}

/** One request to GitHub, before the token is added. */
export interface GitHubRequest {
    url: string;
    method: 'GET' | 'POST' | 'PUT';
    headers: Record<string, string>;
    body?: string;
}

/** An answer GitHub did not refuse. */
export interface GitHubAnswer {
    /** A 2xx, or 304 to a conditional request. */
    status: number;
    headers: Headers;
    /** The parsed JSON body; `undefined` when empty (a 304) or not JSON. */
    payload: unknown;
    /** The answer's `retry-after`, in seconds; for errors the caller raises from a 2xx answer. */
    retryAfter: number | undefined;
}

/**
 * Sends one request to GitHub with the user's token — the part the GraphQL and the REST requester share, so
 * both report rate limits and fail the same way. Reports the answer's rate-limit bucket to `onRateLimit`
 * and throws {@link GitHubApiError} on any answer that is neither 2xx nor 304.
 */
export async function sendGitHubRequest(
    options: GitHubRequesterOptions,
    request: GitHubRequest,
): Promise<GitHubAnswer> {
    const { getToken, fetch = globalThis.fetch, onRateLimit } = options;

    const response = await fetch(request.url, {
        method: request.method,
        headers: { ...request.headers, Authorization: `Bearer ${await getToken()}` },
        body: request.body,
    });

    const rateLimit = readRateLimit(response.headers);
    if (rateLimit && onRateLimit) {
        onRateLimit(rateLimit);
    }

    const body = await response.text();
    const payload = parseJson(body);
    const retryAfter = readRetryAfter(response.headers);

    if (!response.ok && response.status !== 304) {
        const githubMessage = readMessage(payload);
        const message = githubMessage ?? (body || response.statusText);
        throw new GitHubApiError({
            status: response.status,
            message: `GitHub request failed: ${response.status} ${message}`,
            githubMessage,
            errors: readGitHubErrors(payload),
            retryAfter,
        });
    }

    return { status: response.status, headers: response.headers, payload, retryAfter };
}

function readRateLimit(headers: Headers): GitHubRateLimit | undefined {
    const resource = headers.get('x-ratelimit-resource');
    const limit = Number(headers.get('x-ratelimit-limit') ?? Number.NaN);
    const remaining = Number(headers.get('x-ratelimit-remaining') ?? Number.NaN);
    // Seconds since the epoch.
    const reset = Number(headers.get('x-ratelimit-reset') ?? Number.NaN);

    if (!resource || Number.isNaN(limit) || Number.isNaN(remaining) || Number.isNaN(reset)) {
        return undefined;
    }

    return { resource, limit, remaining, resetAt: new Date(reset * 1000) };
}

function readRetryAfter(headers: Headers) {
    // GitHub sends whole seconds; the HTTP-date form the standard also allows is not used.
    const seconds = Number(headers.get('retry-after') ?? Number.NaN);
    return Number.isNaN(seconds) ? undefined : seconds;
}

function readMessage(payload: unknown) {
    return isPlainObject(payload) && typeof payload.message === 'string' ? payload.message : undefined;
}
