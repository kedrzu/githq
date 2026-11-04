import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import type { RunVerdict } from '../WorkflowTypes.js';
import { getStandingVerdict } from './getStandingVerdict.js';
import { sortRunsByCreation } from './sortRunsByCreation.js';

/**
 * A workflow's verdict from its runs (actions D1): the verdict of the latest run, by creation time, that has one,
 * so a row of cancelled or skipped runs after a failure keeps the workflow broken, and so does re-running the failure. `null` when no run has one.
 * Pass the runs that count only.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getWorkflowVerdict(runs: readonly GitHubWorkflowRun[]): RunVerdict | null {
    for (const run of sortRunsByCreation(runs).toReversed()) {
        const verdict = getStandingVerdict(run);
        if (verdict !== null) {
            return verdict;
        }
    }

    return null;
}
