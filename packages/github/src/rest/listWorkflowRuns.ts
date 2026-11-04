import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import { readNextPageUrl } from '../utils/readNextPageUrl.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';
import { readWorkflowRuns } from './readWorkflowRuns.js';
import type { GitHubWorkflowRun } from './readWorkflowRuns.js';

/** Which workflow's runs to list, on which ref, and the ETag of the last answer. */
export interface ListWorkflowRunsParams {
    /** `owner/name`. */
    nameWithOwner: string;
    workflowId: number;
    /** Only runs on this exact branch or tag (GitHub matches no wildcards); every ref's when absent. */
    branch?: string;
    /** Runs a page; GitHub's default, 30, when absent. */
    perPage?: number;
    /**
     * A `nextPageUrl` an earlier call returned: that page is asked instead of the first. It carries the query
     * already, so `branch` and `perPage` are not added again.
     */
    pageUrl?: string;
    /** The ETag the last 200 of the same page returned; GitHub answers 304, free of quota, while nothing changed. */
    etag?: string;
}

/** Nothing changed since the ETag (free), or one page of the workflow's runs. */
export type ListWorkflowRunsResult =
    | { status: 304 }
    | {
          status: 200;
          /** `undefined` when GitHub sent none — the next call cannot be conditional. */
          etag: string | undefined;
          /** The newest first. */
          runs: GitHubWorkflowRun[];
          /** The page after this one, for `pageUrl`; `undefined` on the last page. */
          nextPageUrl: string | undefined;
      };

/**
 * Lists one page of a workflow's runs (`GET /repos/{o}/{r}/actions/workflows/{id}/runs`) with `If-None-Match`; a
 * 304 is free of quota. One page a call: matching a wildcard pattern happens in the client, so the caller pages
 * on only while it still lacks runs that count (actions D2).
 *
 * Throws {@link GitHubApiError} when GitHub refuses or the answer is not a list of runs.
 */
export async function listWorkflowRuns(
    rest: GitHubRestRequester,
    params: ListWorkflowRunsParams,
): Promise<ListWorkflowRunsResult> {
    const { nameWithOwner, workflowId, branch, perPage, pageUrl, etag } = params;
    const query: Record<string, string> = {};
    if (pageUrl === undefined) {
        if (branch !== undefined) {
            query.branch = branch;
        }

        if (perPage != null) {
            query.per_page = String(perPage);
        }
    }

    const answer = await rest({
        url: pageUrl ?? `${getRepositoryRestPath(nameWithOwner)}/actions/workflows/${workflowId}/runs`,
        query,
        etag,
        // Read anew each time a workflow unfolds: GitHub marks the answer cacheable for a minute.
        cache: 'no-store',
    });
    if (answer.status === 304) {
        return { status: 304 };
    }

    return {
        status: 200,
        etag: answer.headers.get('etag') ?? undefined,
        runs: readWorkflowRuns(answer.status, answer.payload),
        nextPageUrl: readNextPageUrl(answer.headers),
    };
}
