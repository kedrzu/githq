/// <reference types="bun" />
import type { GitHubWorkflowRunDetail } from '@githq/github/rest/getWorkflowRun.js';
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';
import { expect, mock, test } from 'bun:test';

import { buildWorkflowRun, getWorkflowLogPane } from './buildWorkflowRun.js';
import type { BuildWorkflowRunParams } from './buildWorkflowRun.js';
import { getJobMark } from './utils/getJobMark.js';
import type { WorkflowJobsState, WorkflowRunState } from './WorkflowRunStore.js';

const RUN: GitHubWorkflowRunDetail = {
    id: 1,
    workflowId: 7,
    runNumber: 12,
    headBranch: 'main',
    event: 'push',
    status: 'completed',
    conclusion: 'failure',
    createdAt: '2026-11-02T10:00:00Z',
    updatedAt: '2026-11-02T10:03:00Z',
    htmlUrl: 'https://github.com/acme/web/actions/runs/1',
    headSha: 'abc',
    displayTitle: 'Fix',
    workflowName: 'Deploy',
    headCommitMessage: null,
    runAttempt: null,
};
const NOW = Date.parse('2026-11-02T12:00:00Z');

test('failed jobs come first, then those not finished, the others in GitHub’s order; the head counts them', () => {
    const { jobs, counts } = build({
        jobs: ready(
            job(1, 'lint', 'success'),
            job(2, 'deploy', 'skipped'),
            job(3, 'e2e', null, 'queued'),
            job(4, 'build', 'failure'),
            job(5, 'test', null),
            job(6, 'docs', 'cancelled'),
        ),
    });

    expect(jobs.map(entry => entry.name)).toEqual(['build', 'e2e', 'test', 'lint', 'deploy', 'docs']);
    expect(counts).toEqual({ failed: 1, running: 1, waiting: 1, skipped: 1, passed: 1, none: 1 });
});

test('the job the address names is selected; otherwise, or if the run has no such job, the first failed, else the first', () => {
    const jobs = ready(job(1, 'lint', 'success'), job(2, 'build', 'failure'));

    expect(build({ jobs, jobId: 1 }).selectedJob?.name).toBe('lint');
    expect(build({ jobs }).selectedJob?.name).toBe('build');
    expect(build({ jobs, jobId: 99 }).selectedJob?.name).toBe('build');
    expect(build({ jobs: ready(job(1, 'lint', 'success'), job(3, 'test', 'success')) }).selectedJob?.name).toBe('lint');
    expect(build({ jobs: ready() }).selectedJob).toBeNull();
});

test('with no job in the address the job shown stays, whatever a poll does to the order; it gives way only once it is gone', () => {
    const jobs = ready(job(1, 'build', 'success'), job(2, 'deploy', null, 'queued'), job(3, 'test', 'failure'));

    expect(build({ jobs }).selectedJob?.name).toBe('test');
    expect(build({ jobs, shownJobId: 1 }).selectedJob?.name).toBe('build');
    expect(build({ jobs, shownJobId: 1 }).jobs.map(entry => entry.name)).toEqual(['test', 'deploy', 'build']);
    // The address still decides.
    expect(build({ jobs, jobId: 2, shownJobId: 1 }).selectedJob?.name).toBe('deploy');
    // A re-run numbers its jobs anew.
    expect(build({ jobs, shownJobId: 99 }).selectedJob?.name).toBe('test');
});

test('a failed run with no jobs is an invalid workflow file; one that did not fail just has none', () => {
    expect(build({ jobs: ready() }).body).toEqual({ kind: 'invalidFile' });
    expect(build({ jobs: ready(), run: known({ conclusion: 'startup_failure' }) }).body).toEqual({
        kind: 'invalidFile',
    });
    expect(build({ jobs: ready(), run: known({ conclusion: 'cancelled' }) }).body).toEqual({
        kind: 'noJobs',
        going: false,
    });
    expect(build({ jobs: ready(), run: known({ status: 'queued', conclusion: null }) }).body).toEqual({
        kind: 'noJobs',
        going: true,
    });
});

test('while the jobs load, or no run is known to judge them by, the columns wait in place', () => {
    expect(build({ jobs: { jobs: [], status: 'loading', httpStatus: null, checkedAt: null } }).body).toEqual({
        kind: 'loading',
    });
    expect(build({ jobs: ready(), run: { run: null, status: 'loading', httpStatus: null } }).body).toEqual({
        kind: 'loading',
    });
});

test('a run or its jobs GitHub no longer has is gone, even with a stored copy', () => {
    expect(build({ run: { run: RUN, status: 'gone', httpStatus: null } }).body).toEqual({ kind: 'gone' });
    expect(build({ jobs: { jobs: [], status: 'gone', httpStatus: null, checkedAt: null } }).body).toEqual({
        kind: 'gone',
    });
});

test('a failed read says so only where nothing stands in for it', () => {
    expect(build({ run: { run: null, status: 'failed', httpStatus: 502 } }).body).toEqual({
        kind: 'runFailed',
        httpStatus: 502,
    });
    expect(build({ jobs: { jobs: [], status: 'failed', httpStatus: 500, checkedAt: null } }).body).toEqual({
        kind: 'jobsFailed',
        httpStatus: 500,
    });
    // The stored copy stands in for a failed read of the run, and the jobs known for a failed read of the jobs.
    const jobs = ready(job(1, 'build', 'failure'));
    expect(build({ jobs, run: { run: RUN, status: 'failed', httpStatus: 502 } }).body).toEqual({ kind: 'jobs' });
    expect(build({ jobs: { ...jobs, status: 'failed', httpStatus: 500 } }).body).toEqual({ kind: 'jobs' });
});

test('it goes on while the run has not finished, or a job known has not: the jobs may be read before the run ends', () => {
    const passed = ready(job(1, 'build', 'success'));

    expect(build({ jobs: passed }).going).toBe(false);
    expect(build({ jobs: passed, run: known({ status: 'in_progress', conclusion: null }) }).going).toBe(true);
    expect(build({ jobs: ready(job(1, 'build', null)) }).going).toBe(true);
    expect(build({ jobs: passed, run: { run: null, status: 'loading', httpStatus: null } }).going).toBe(false);
    // What GitHub no longer shows is not going, whatever the last copy of it says: asking again only spends allowance.
    const running = known({ status: 'in_progress', conclusion: null });
    expect(build({ run: { ...running, status: 'gone' }, jobs: passed }).going).toBe(false);
    expect(build({ run: running, jobs: { jobs: [], status: 'gone', httpStatus: null, checkedAt: null } }).going).toBe(
        false,
    );
});

test('a job’s and a step’s mark: running, waiting, then by the conclusion', () => {
    expect(getJobMark({ status: 'in_progress', conclusion: null })).toBe('running');
    expect(getJobMark({ status: 'queued', conclusion: null })).toBe('waiting');
    expect(getJobMark({ status: 'completed', conclusion: 'failure' })).toBe('failed');
    expect(getJobMark({ status: 'completed', conclusion: 'timed_out' })).toBe('failed');
    expect(getJobMark({ status: 'completed', conclusion: 'success' })).toBe('passed');
    expect(getJobMark({ status: 'completed', conclusion: 'skipped' })).toBe('skipped');
    expect(getJobMark({ status: 'completed', conclusion: 'cancelled' })).toBe('none');
});

test('a log is read only for a job that finished and ran', () => {
    const readLog = mock(() => ({ status: 'gone' }) as const);

    expect(getWorkflowLogPane({ job: null, readLog: readLog, now: NOW }).kind).toBe('loading');
    expect(getWorkflowLogPane({ job: job(1, 'build', null), readLog: readLog, now: NOW }).kind).toBe('running');
    expect(getWorkflowLogPane({ job: job(1, 'build', null, 'queued'), readLog: readLog, now: NOW }).kind).toBe(
        'running',
    );
    expect(getWorkflowLogPane({ job: job(1, 'build', 'skipped'), readLog: readLog, now: NOW }).kind).toBe('neverRan');
    expect(readLog).not.toHaveBeenCalled();

    expect(getWorkflowLogPane({ job: job(1, 'build', 'failure'), readLog: readLog, now: NOW }).kind).toBe('gone');
    expect(readLog).toHaveBeenCalledTimes(1);
});

test('a job cancelled before starting never ran: no steps, no log read, GitHub would only answer 404', () => {
    const readLog = mock(() => ({ status: 'gone' }) as const);

    expect(getWorkflowLogPane({ job: job(1, 'build', 'cancelled'), readLog: readLog, now: NOW }).kind).toBe('neverRan');
    expect(readLog).not.toHaveBeenCalled();

    const started = {
        ...job(1, 'build', 'cancelled'),
        steps: [
            {
                name: 'Set up job',
                number: 1,
                status: 'completed',
                conclusion: 'success',
                startedAt: null,
                completedAt: null,
            },
        ],
    };
    expect(getWorkflowLogPane({ job: started, readLog: readLog, now: NOW }).kind).toBe('gone');
    expect(readLog).toHaveBeenCalledTimes(1);
});

test('a finished job’s pane follows its log’s read', () => {
    const build1 = job(1, 'build', 'failure');
    expect(getWorkflowLogPane({ job: build1, readLog: () => ({ status: 'loading' }), now: NOW }).kind).toBe('loading');
    expect(
        getWorkflowLogPane({ job: build1, readLog: () => ({ status: 'failed', httpStatus: 502 }), now: NOW }),
    ).toEqual({
        kind: 'failed',
        job: build1,
        httpStatus: 502,
    });
    const log = { lines: [], errors: [], steps: [], characters: 0 };
    expect(getWorkflowLogPane({ job: build1, readLog: () => ({ status: 'ready', log }), now: NOW })).toEqual({
        kind: 'ready',
        job: build1,
        log,
    });
});

test('GitHub having no log for a job finished under 5 minutes ago means not yet: the page asks again; after that, gone', () => {
    const finished = (minutes: number) => ({
        ...job(1, 'build', 'failure'),
        completedAt: new Date(NOW - minutes * 60_000).toISOString(),
    });
    const readLog = () => ({ status: 'gone' }) as const;

    expect(getWorkflowLogPane({ job: finished(0), readLog: readLog, now: NOW })).toMatchObject({
        kind: 'loading',
        notThereYet: true,
    });
    expect(getWorkflowLogPane({ job: finished(4.9), readLog: readLog, now: NOW })).toMatchObject({
        kind: 'loading',
        notThereYet: true,
    });
    expect(getWorkflowLogPane({ job: finished(5), readLog: readLog, now: NOW }).kind).toBe('gone');
});

function build(params: Partial<BuildWorkflowRunParams>) {
    return buildWorkflowRun({
        run: { run: RUN, status: 'ready', httpStatus: null },
        jobs: ready(),
        jobId: null,
        shownJobId: null,
        ...params,
    });
}

function known(change: Partial<GitHubWorkflowRunDetail>): WorkflowRunState {
    return { run: { ...RUN, ...change }, status: 'ready', httpStatus: null };
}

function ready(...jobs: GitHubWorkflowJob[]): WorkflowJobsState {
    return { jobs, status: 'ready', httpStatus: null, checkedAt: null };
}

function job(
    id: number,
    name: string,
    conclusion: string | null,
    status = conclusion === null ? 'in_progress' : 'completed',
) {
    return {
        id,
        name,
        status,
        conclusion,
        startedAt: null,
        completedAt: null,
        steps: [],
    } satisfies GitHubWorkflowJob;
}
