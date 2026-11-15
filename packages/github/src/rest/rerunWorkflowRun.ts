import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** The workflow run to re-run whole. */
export interface RerunWorkflowRunParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly runId: number;
}

/**
 * Re-runs every job of a GitHub Actions run (`POST …/actions/runs/{id}/rerun`), which GraphQL has no mutation for.
 * Throws `GitHubApiError` when GitHub refuses it, as for a run still going or one over a month old.
 */
export async function rerunWorkflowRun(rest: GitHubRestRequester, params: RerunWorkflowRunParams): Promise<void> {
    const { nameWithOwner, runId } = params;
    await rest({ method: 'POST', url: `${getRepositoryRestPath(nameWithOwner)}/actions/runs/${runId}/rerun` });
}
