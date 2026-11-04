/// <reference types="bun" />
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { expect, test } from 'bun:test';

import { describeWorkflowRun } from './describeWorkflowRun.js';

const NOW = Date.parse('2026-11-02T12:00:00Z');

test('a finished run with a verdict is marked by it and says how long it ran, once its times are known', () => {
    expect(
        describeWorkflowRun(
            run({ conclusion: 'failure', runStartedAt: '2026-11-02T11:00:05Z', updatedAt: '2026-11-02T11:03:17Z' }),
            NOW,
        ),
    ).toEqual({ mark: 'failed', tail: { kind: 'duration', ms: 192_000 } });
    expect(describeWorkflowRun(run({ conclusion: 'success' }), NOW)).toEqual({ mark: 'passed', tail: null });
});

test('a run that says nothing names its conclusion', () => {
    expect(describeWorkflowRun(run({ conclusion: 'cancelled' }), NOW)).toEqual({
        mark: 'none',
        tail: { kind: 'conclusion', conclusion: 'cancelled' },
    });
});

test('a run going says for how long once started, its status before', () => {
    expect(
        describeWorkflowRun(
            run({ status: 'in_progress', conclusion: null, runStartedAt: '2026-11-02T11:58:40Z' }),
            NOW,
        ),
    ).toEqual({ mark: 'running', tail: { kind: 'running', ms: 80_000 } });
    expect(describeWorkflowRun(run({ status: 'in_progress', conclusion: null }), NOW)).toEqual({
        mark: 'running',
        tail: { kind: 'status', status: 'in progress' },
    });
    expect(describeWorkflowRun(run({ status: 'queued', conclusion: null }), NOW)).toEqual({
        mark: 'running',
        tail: { kind: 'status', status: 'queued' },
    });
});

function run(fields: Partial<GitHubWorkflowRun>): GitHubWorkflowRun {
    return {
        id: 1,
        workflowId: 7,
        runNumber: 1,
        headBranch: 'main',
        event: 'push',
        status: 'completed',
        conclusion: 'success',
        createdAt: '2026-11-02T11:00:00Z',
        htmlUrl: 'https://github.com/kedrzu/githq/actions/runs/1',
        headSha: 'abc',
        displayTitle: 'Run',
        updatedAt: '2026-11-02T11:00:00Z',
        ...fields,
    };
}
