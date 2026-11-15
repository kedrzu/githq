import type { GitHubWorkflowRunDetail } from '@githq/github/rest/getWorkflowRun.js';
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';

import { SAMPLE_WORKFLOWS_NOW } from './sampleWorkflows.js';

/** When the sample run started: 2 minutes before it ended, before {@link SAMPLE_WORKFLOWS_NOW}. */
const START = SAMPLE_WORKFLOWS_NOW - 120_000 - 234_000;

/** A run of Deploy that passed in 3m 54s, as actions W34 draws it, its jobs in {@link SAMPLE_PASSED_JOBS}. */
export const SAMPLE_PASSED_RUN: GitHubWorkflowRunDetail = {
    id: 4825,
    workflowId: 1,
    runNumber: 4825,
    headBranch: 'main',
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    createdAt: at(0),
    runStartedAt: at(0),
    updatedAt: at(234),
    htmlUrl: 'https://github.com/fitloop/webapp/actions/runs/4825',
    headSha: '9b07d1e5c2a4f6b8d0e1f2a3b4c5d6e7f8091a2b',
    displayTitle: 'Retry the cache warmup on deploy',
    workflowName: 'Deploy',
    headCommitMessage: 'Retry the cache warmup on deploy',
    runAttempt: 1,
    actor: { login: 'dkim', avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4' },
};

/** The sample run's seven jobs, all passed: six side by side from the start, deploy after them. */
export const SAMPLE_PASSED_JOBS: readonly GitHubWorkflowJob[] = [
    passedJob(201, 'build', 0, 144),
    passedJob(202, 'deploy', 186, 234),
    passedJob(203, 'lint', 0, 41),
    passedJob(204, 'typecheck', 0, 62),
    passedJob(205, 'test (node 20)', 0, 168),
    passedJob(206, 'test (node 22)', 0, 171),
    passedJob(207, 'e2e (chromium)', 0, 184),
];

/** A job of the sample run from `startedS` to `completedS` seconds after it started, with `conclusion`. */
export function sampleRunJob(
    id: number,
    name: string,
    startedS: number | null,
    completedS: number | null,
    conclusion: string | null,
): GitHubWorkflowJob {
    return {
        id,
        name,
        status: completedS !== null ? 'completed' : startedS === null ? 'queued' : 'in_progress',
        conclusion,
        startedAt: startedS === null ? null : at(startedS),
        completedAt: completedS === null ? null : at(completedS),
        steps: [
            {
                name: 'Set up job',
                number: 1,
                status: 'completed',
                conclusion: 'success',
                startedAt: at(startedS ?? 0),
                completedAt: at((startedS ?? 0) + 2),
            },
        ],
    };
}

function passedJob(id: number, name: string, startedS: number, completedS: number) {
    return sampleRunJob(id, name, startedS, completedS, 'success');
}

function at(seconds: number) {
    return new Date(START + seconds * 1000).toISOString();
}
