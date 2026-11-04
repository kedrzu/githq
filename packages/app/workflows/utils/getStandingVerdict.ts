import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import type { RunVerdict } from '../WorkflowTypes.js';
import { getRunVerdict } from './getRunVerdict.js';

/**
 * What a run says of its workflow as things stand (actions D1): its verdict, or, while it is being re-run, the one it had
 * before. The run that broke a workflow is the one re-run, and until it finishes again it is still what decides: the
 * workflow stays broken, whatever passed before it (W4j).
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getStandingVerdict(run: GitHubWorkflowRun): RunVerdict | null {
    return getRunVerdict(run) ?? getRunVerdict({ conclusion: run.conclusionBeforeRerun ?? null });
}
