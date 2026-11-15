import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** The workflow to run, on what, with what. */
export interface DispatchWorkflowParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly workflowId: number;
    /** The branch or tag to run it on. */
    readonly ref: string;
    /** The values of the workflow's `workflow_dispatch` inputs, at most 25; its defaults for those not given. */
    readonly inputs?: Readonly<Record<string, string | number | boolean>>;
}

/** The run GitHub started. */
export interface DispatchWorkflowResult {
    readonly runId: number;
    /** The run's page on github.com. */
    readonly htmlUrl: string;
}

/**
 * Runs a workflow (`POST …/actions/workflows/{id}/dispatches`), which GraphQL has no mutation for, and answers the run
 * it started: asked with `return_run_details`, or GitHub answers 204 with nothing. Throws `GitHubApiError` when GitHub
 * refuses it, as with 422 for a ref whose workflow has no `workflow_dispatch` trigger or for inputs it does not take,
 * and when the answer names no run.
 */
export async function dispatchWorkflow(
    rest: GitHubRestRequester,
    params: DispatchWorkflowParams,
): Promise<DispatchWorkflowResult> {
    const { nameWithOwner, workflowId, ref, inputs } = params;
    const answer = await rest({
        method: 'POST',
        url: `${getRepositoryRestPath(nameWithOwner)}/actions/workflows/${workflowId}/dispatches`,
        body: { ref, ...(inputs === undefined ? {} : { inputs }), return_run_details: true },
    });

    const { payload } = answer;
    if (
        !isPlainObject(payload) ||
        typeof payload.workflow_run_id !== 'number' ||
        typeof payload.html_url !== 'string'
    ) {
        throw new GitHubApiError({ status: answer.status, message: 'GitHub workflow dispatch answer is malformed' });
    }

    return { runId: payload.workflow_run_id, htmlUrl: payload.html_url };
}
