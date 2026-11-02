import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';

/** One run of a GitHub Actions workflow, as the run lists give it (`workflow_runs[]`), cut to what githq keeps. */
export interface GitHubWorkflowRun {
    readonly id: number;
    readonly workflowId: number;
    /** The run's number within its workflow, `#123` on GitHub. */
    readonly runNumber: number;
    /** The branch or tag the run is on — a tag's name too; `null` when GitHub names none. */
    readonly headBranch: string | null;
    /** What started it: `push`, `schedule`, `pull_request`, `pull_request_target`, `workflow_dispatch`, … */
    readonly event: string;
    /** `queued`, `in_progress`, `completed`, `waiting`, … */
    readonly status: string;
    /** `success`, `failure`, `cancelled`, `skipped`, …; `null` while the run has not finished. */
    readonly conclusion: string | null;
    /** ISO; "latest" is by this time. */
    readonly createdAt: string;
    readonly htmlUrl: string;
    readonly headSha: string;
    /** What GitHub titles the run with: the commit's or the pull request's title. */
    readonly displayTitle: string;
    /** ISO; when this attempt started running. Absent when GitHub gives none. */
    readonly runStartedAt?: string;
    /** ISO; when the run last changed — once completed, when it finished. */
    readonly updatedAt: string;
}

/**
 * Reads the runs of a workflow's run list answer (`{ total_count, workflow_runs }`).
 *
 * Throws {@link GitHubApiError} when the answer is not a list of runs, so nothing malformed is stored.
 * @__NO_SIDE_EFFECTS__
 */
export function readWorkflowRuns(status: number, payload: unknown): GitHubWorkflowRun[] {
    if (!isPlainObject(payload) || !Array.isArray(payload.workflow_runs)) {
        throw malformed(status);
    }

    const runs: GitHubWorkflowRun[] = [];
    for (const entry of payload.workflow_runs) {
        if (
            !isPlainObject(entry) ||
            typeof entry.id !== 'number' ||
            typeof entry.workflow_id !== 'number' ||
            typeof entry.run_number !== 'number' ||
            !(entry.head_branch === null || typeof entry.head_branch === 'string') ||
            typeof entry.event !== 'string' ||
            typeof entry.status !== 'string' ||
            !(entry.conclusion === null || typeof entry.conclusion === 'string') ||
            typeof entry.created_at !== 'string' ||
            typeof entry.html_url !== 'string' ||
            typeof entry.head_sha !== 'string' ||
            typeof entry.display_title !== 'string' ||
            typeof entry.updated_at !== 'string'
        ) {
            throw malformed(status);
        }

        runs.push({
            id: entry.id,
            workflowId: entry.workflow_id,
            runNumber: entry.run_number,
            headBranch: entry.head_branch,
            event: entry.event,
            status: entry.status,
            conclusion: entry.conclusion,
            createdAt: entry.created_at,
            htmlUrl: entry.html_url,
            headSha: entry.head_sha,
            displayTitle: entry.display_title,
            updatedAt: entry.updated_at,
            ...(typeof entry.run_started_at === 'string' && { runStartedAt: entry.run_started_at }),
        });
    }

    return runs;
}

function malformed(status: number) {
    return new GitHubApiError({ status, message: 'GitHub workflow run list answer is malformed' });
}
