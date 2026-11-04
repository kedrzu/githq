import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';

import { getRunVerdict } from './getRunVerdict.js';

/** How a job or a step stands: by its status while it has not finished, by its conclusion after. */
export type WorkflowJobMark = 'failed' | 'running' | 'waiting' | 'skipped' | 'passed' | 'none';

/**
 * How a job or a step stands.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getJobMark(job: Pick<GitHubWorkflowJob, 'status' | 'conclusion'>): WorkflowJobMark {
    if (job.status !== 'completed') {
        return job.status === 'in_progress' ? 'running' : 'waiting';
    }

    if (job.conclusion === 'skipped') {
        return 'skipped';
    }

    return getRunVerdict(job) ?? 'none';
}
