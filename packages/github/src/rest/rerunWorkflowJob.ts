import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** The job of a workflow run to re-run. */
export interface RerunWorkflowJobParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly jobId: number;
}

/**
 * Re-runs one job of a GitHub Actions run, and the jobs depending on it (`POST …/actions/jobs/{id}/rerun`), which
 * GraphQL has no mutation for. Throws `GitHubApiError` when GitHub refuses it, as for a run still going.
 */
export async function rerunWorkflowJob(rest: GitHubRestRequester, params: RerunWorkflowJobParams): Promise<void> {
    const { nameWithOwner, jobId } = params;
    await rest({ method: 'POST', url: `${getRepositoryRestPath(nameWithOwner)}/actions/jobs/${jobId}/rerun` });
}
