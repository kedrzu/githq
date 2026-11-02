/// <reference types="bun" />
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { expect, test } from 'bun:test';

import { getWorkflowVerdict } from './getWorkflowVerdict.js';

test.each([
    ['failure', 'failed'],
    ['timed_out', 'failed'],
    ['startup_failure', 'failed'],
    ['success', 'passed'],
    ['cancelled', null],
    ['skipped', null],
    ['neutral', null],
    ['action_required', null],
    ['stale', null],
    ['something_github_adds_later', null],
    [null, null],
] as const)('a run concluded %p gives the verdict %p', (conclusion, verdict) => {
    expect(getWorkflowVerdict([run(1, '2026-11-01T03:00:00Z', conclusion)])).toBe(verdict);
});

test('cancelled and skipped runs after a failure keep it failed: reading goes back to a run with a verdict', () => {
    expect(
        getWorkflowVerdict([
            run(4, '2026-11-01T06:00:00Z', null),
            run(3, '2026-11-01T05:00:00Z', 'skipped'),
            run(2, '2026-11-01T04:00:00Z', 'cancelled'),
            run(1, '2026-11-01T03:00:00Z', 'failure'),
            run(0, '2026-11-01T02:00:00Z', 'success'),
        ]),
    ).toBe('failed');
});

test('the latest is by creation time, not by the order given', () => {
    expect(
        getWorkflowVerdict([run(2, '2026-11-01T03:00:00Z', 'failure'), run(1, '2026-11-01T04:00:00Z', 'success')]),
    ).toBe('passed');
});

test('no runs, or none with a verdict, give none', () => {
    expect(getWorkflowVerdict([])).toBeNull();
    expect(getWorkflowVerdict([run(1, '2026-11-01T03:00:00Z', 'cancelled')])).toBeNull();
});

function run(id: number, createdAt: string, conclusion: string | null): GitHubWorkflowRun {
    return {
        id,
        workflowId: 7,
        runNumber: id,
        headBranch: 'main',
        event: 'push',
        status: conclusion === null ? 'in_progress' : 'completed',
        conclusion,
        createdAt,
        htmlUrl: `https://github.com/kedrzu/githq/actions/runs/${id}`,
        headSha: 'abc',
    };
}
