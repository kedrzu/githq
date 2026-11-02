import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';
import { readWorkflowRuns } from './readWorkflowRuns.js';
import type { GitHubWorkflowRun } from './readWorkflowRuns.js';

/** Which repository to look at, and the ETag of the last answer. */
export interface ListRepositoryRunsParams {
    /** `owner/name`. */
    nameWithOwner: string;
    /** The ETag the last 200 returned; GitHub answers 304, free of quota, while nothing changed. */
    etag?: string;
    /** How many of the latest runs to ask for; 10 by default — a run weighs about 12 KB in the answer. */
    perPage?: number;
}

/** Nothing changed since the ETag (free), or the repository's latest runs, any workflow's. */
export type ListRepositoryRunsResult =
    | { status: 304 }
    | {
          status: 200;
          /** `undefined` when GitHub sent none — the next call cannot be conditional. */
          etag: string | undefined;
          /** The newest first. */
          runs: GitHubWorkflowRun[];
      };

/**
 * Lists a repository's latest workflow runs, of every workflow (`GET /repos/{o}/{r}/actions/runs`), with
 * `If-None-Match` — the workflows' change signal (actions D2). Its ETag moves with any run's status, so a 304 says
 * no run moved; on a 200 the runs tell which workflows did. A small page on purpose: a busy workflow fills it, so
 * it is no list of every workflow's latest run.
 *
 * Throws {@link GitHubApiError} when GitHub refuses or the answer is not a list of runs.
 */
export async function listRepositoryRuns(
    rest: GitHubRestRequester,
    params: ListRepositoryRunsParams,
): Promise<ListRepositoryRunsResult> {
    const { nameWithOwner, etag, perPage = 10 } = params;
    const answer = await rest({
        url: `${getRepositoryRestPath(nameWithOwner)}/actions/runs`,
        query: { per_page: String(perPage) },
        etag,
    });
    if (answer.status === 304) {
        return { status: 304 };
    }

    return {
        status: 200,
        etag: answer.headers.get('etag') ?? undefined,
        runs: readWorkflowRuns(answer.status, answer.payload),
    };
}
