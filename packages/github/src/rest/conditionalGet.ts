import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** What to fetch, and the ETag of the copy already held. */
export interface ConditionalGetParams {
    /** A path under `https://api.github.com`, or a full URL GitHub handed out. */
    url: string;
    etag?: string;
}

/** Unchanged since `etag` (free of quota), or changed, with the new ETag to send next time. */
export type ConditionalGetResult =
    | { status: 304 }
    | {
          status: 200;
          /** `undefined` when GitHub sent none — the next call cannot be conditional. */
          etag: string | undefined;
          /** The parsed JSON body, for the caller to validate. */
          body: unknown;
      };

/**
 * `GET`s a REST resource with `If-None-Match`: GitHub answers 304 without charging the rate limit while
 * nothing changed — how the local copy notices changes to a project or a repository's issues (D7).
 */
export async function conditionalGet(
    rest: GitHubRestRequester,
    params: ConditionalGetParams,
): Promise<ConditionalGetResult> {
    const answer = await rest({ url: params.url, etag: params.etag });
    if (answer.status === 304) {
        return { status: 304 };
    }

    return { status: 200, etag: answer.headers.get('etag') ?? undefined, body: answer.payload };
}
