import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** The workflow to turn on or off. */
export interface SetWorkflowEnabledParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly workflowId: number;
    readonly enabled: boolean;
}

/**
 * Enables or disables a workflow (`PUT …/actions/workflows/{id}/enable` or `/disable`), which GraphQL has no mutation
 * for: a disabled workflow starts no runs, by any trigger. Throws `GitHubApiError` when GitHub refuses it.
 */
export async function setWorkflowEnabled(rest: GitHubRestRequester, params: SetWorkflowEnabledParams): Promise<void> {
    const { nameWithOwner, workflowId, enabled } = params;
    await rest({
        method: 'PUT',
        url: `${getRepositoryRestPath(nameWithOwner)}/actions/workflows/${workflowId}/${enabled ? 'enable' : 'disable'}`,
    });
}
