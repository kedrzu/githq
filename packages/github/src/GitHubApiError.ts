import { HttpError } from '@nzyme/fetch-utils/HttpError.js';

/** One entry of the `errors` array of a GitHub GraphQL answer. */
export interface GitHubGraphQLErrorEntry {
    /**
     * GitHub's machine-readable error kind — `NOT_FOUND`, `FORBIDDEN`, `INSUFFICIENT_SCOPES`, `RATE_LIMITED`, … —
     * absent on errors that are not GitHub's own, like a query that does not parse.
     */
    type?: string;
    message: string;
    /** The response field the error belongs to, e.g. `['repository', 'issue']`. */
    path?: readonly (number | string)[];
}

/** What a {@link GitHubApiError} is made of. */
export interface GitHubApiErrorOptions {
    /** The HTTP status of the answer — GitHub reports most GraphQL errors with a 200. */
    status: number;
    message: string;
    /** The GraphQL errors of the answer; none when GitHub answered with a bare HTTP error. */
    errors?: readonly GitHubGraphQLErrorEntry[];
    /** The answer's `retry-after`, in seconds. */
    retryAfter?: number;
}

/**
 * Thrown by the GitHub requesters, GraphQL and REST alike, when GitHub refuses a request: a non-2xx HTTP
 * answer (401 is an expired or revoked token) or a GraphQL answer carrying an `errors` array, even next to
 * partial data — a write that reported an error is treated as not done, so an optimistic edit gets rolled back.
 *
 * An {@link HttpError}, so code that handles HTTP failures in general recognises it.
 */
export class GitHubApiError extends HttpError {
    /** The GraphQL errors of the answer; empty when GitHub answered with a bare HTTP error or over REST. */
    readonly errors: readonly GitHubGraphQLErrorEntry[];
    /**
     * How many seconds to wait before trying again, from the answer's `retry-after` header: GitHub sends it
     * with a secondary rate limit (403 or 429), so the scheduler can back off. A primary limit has none — its
     * reset time comes through `onRateLimit`.
     */
    readonly retryAfter: number | undefined;

    constructor(options: GitHubApiErrorOptions) {
        super(options.status, options.message);
        this.name = 'GitHubApiError';
        this.errors = options.errors ?? [];
        this.retryAfter = options.retryAfter;
    }
}
