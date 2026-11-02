import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

/**
 * Runs oldest first by creation time — what "latest" means for runs (actions D1) — and by id where two were
 * created in the same second. A new array.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function sortRunsByCreation(runs: readonly GitHubWorkflowRun[]): GitHubWorkflowRun[] {
    return runs.toSorted((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
}
