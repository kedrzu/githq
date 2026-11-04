import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** Which repository to look at, and the ETag of the last answer. */
export interface ListRepositoryRunsParams {
    /** `owner/name`. */
    nameWithOwner: string;
    /** The ETag the last 200 returned; GitHub answers 304, free of quota, while nothing changed. */
    etag?: string;
}

/** Nothing changed since the ETag (free), or some of the repository's latest runs did. */
export type ListRepositoryRunsResult =
    | { status: 304 }
    | {
          status: 200;
          /** `undefined` when GitHub sent none — the next call cannot be conditional. */
          etag: string | undefined;
      };

/**
 * Asks whether a repository's latest workflow runs, of every workflow, moved (`GET /repos/{o}/{r}/actions/runs`),
 * with `If-None-Match` — the workflows' change signal (actions D2). Its ETag moves with the status of any run on the
 * page, so a 304 says none of them moved; the runs themselves are not read, each workflow's are asked on their own.
 * A page of 10: a run weighs about 12 KB in the answer.
 *
 * Throws {@link GitHubApiError} when GitHub refuses.
 */
export async function listRepositoryRuns(
    rest: GitHubRestRequester,
    params: ListRepositoryRunsParams,
): Promise<ListRepositoryRunsResult> {
    const answer = await rest({
        url: `${getRepositoryRestPath(params.nameWithOwner)}/actions/runs`,
        query: { per_page: '10' },
        etag: params.etag,
    });
    if (answer.status === 304) {
        return { status: 304 };
    }

    return { status: 200, etag: answer.headers.get('etag') ?? undefined };
}
