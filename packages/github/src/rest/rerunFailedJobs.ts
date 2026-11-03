import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** The workflow run to re-run the failed jobs of. */
export interface RerunFailedJobsParams {
    /** The repository's owner. */
    readonly owner: string;
    /** The repository's name. */
    readonly name: string;
    /** The run's `databaseId`. */
    readonly runId: number;
}

/**
 * Re-runs the failed jobs of a GitHub Actions run (`POST …/actions/runs/{id}/rerun-failed-jobs`), which GraphQL has no
 * mutation for. Throws `GitHubApiError` when GitHub refuses it, as for a run still going.
 */
export async function rerunFailedJobs(rest: GitHubRestRequester, params: RerunFailedJobsParams): Promise<void> {
    const { owner, name, runId } = params;
    await rest({
        method: 'POST',
        url: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/actions/runs/${runId}/rerun-failed-jobs`,
    });
}
