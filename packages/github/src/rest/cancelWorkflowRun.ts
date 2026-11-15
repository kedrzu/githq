import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** The workflow run to cancel. */
export interface CancelWorkflowRunParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly runId: number;
}

/**
 * Cancels a GitHub Actions run (`POST …/actions/runs/{id}/cancel`), which GraphQL has no mutation for. GitHub takes it
 * (202) and cancels on its own time. Throws `GitHubApiError` when GitHub refuses it, as with 409 for a run that ended.
 */
export async function cancelWorkflowRun(rest: GitHubRestRequester, params: CancelWorkflowRunParams): Promise<void> {
    const { nameWithOwner, runId } = params;
    await rest({ method: 'POST', url: `${getRepositoryRestPath(nameWithOwner)}/actions/runs/${runId}/cancel` });
}
