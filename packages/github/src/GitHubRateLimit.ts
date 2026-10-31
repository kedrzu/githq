/** One of GitHub's rate-limit buckets, read from the `x-ratelimit-*` headers of an answer. */
export interface GitHubRateLimit {
    /**
     * The bucket the answer drew on (`x-ratelimit-resource`): `graphql` (points, 5,000/hour), `core` (REST,
     * 5,000/hour), `search` (30/minute), … — each runs out on its own.
     */
    resource: string;
    /** Points or requests available per window. */
    limit: number;
    /** Left in the current window. */
    remaining: number;
    /** When the window resets and `remaining` goes back to `limit`. */
    resetAt: Date;
}
