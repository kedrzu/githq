/// <reference types="bun" />
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { expect, test } from 'bun:test';

import type { WorkflowRefGroup } from '../WorkflowTypes.js';
import { mergeWorkflowRuns, WORKFLOW_RUNS_KEPT } from './mergeWorkflowRuns.js';

const MAIN: WorkflowRefGroup = { kind: 'defaultBranch', branch: 'main' };
const COUNTED: readonly WorkflowRefGroup[] = [MAIN];

test('merges by id, the read copy winning, the newest first', () => {
    const merged = mergeWorkflowRuns({
        stored: [run(2, null, 2, { status: 'in_progress' }), run(1, 'failure', 1)],
        read: [run(3, 'success', 3), run(2, 'failure', 2)],
        groups: COUNTED,
    });

    expect(merged.map(entry => [entry.id, entry.conclusion])).toEqual([
        [3, 'success'],
        [2, 'failure'],
        [1, 'failure'],
    ]);
});

test('keeps the latest runs only — further back when that is where the run deciding the workflow is', () => {
    const cancelled = Array.from({ length: WORKFLOW_RUNS_KEPT + 5 }, (_, index) =>
        run(100 + index, 'cancelled', 100 + index),
    );

    const without = mergeWorkflowRuns({ stored: [], read: [...cancelled, run(1, 'success', 1)], groups: COUNTED });
    expect(without).toHaveLength(WORKFLOW_RUNS_KEPT + 6);
    expect(without.at(-1)?.id).toBe(1);

    // A failure on a pull request's branch decides nothing: it is not kept past the cap.
    const uncounted = mergeWorkflowRuns({
        stored: [],
        read: [...cancelled, run(1, 'failure', 1, { headBranch: 'feature', event: 'pull_request' })],
        groups: COUNTED,
    });
    expect(uncounted).toHaveLength(WORKFLOW_RUNS_KEPT);
    expect(uncounted[0]?.id).toBe(100 + WORKFLOW_RUNS_KEPT + 4);
});

test('keeps each group’s deciding run, however far back, while runs elsewhere fill the cap', () => {
    const busy = Array.from({ length: WORKFLOW_RUNS_KEPT + 5 }, (_, index) =>
        run(100 + index, 'success', 100 + index, { headBranch: 'feature', event: 'pull_request' }),
    );
    const onMain = run(2, 'success', 50);
    const onTag = run(1, 'failure', 10, { headBranch: 'v1.0' });

    const merged = mergeWorkflowRuns({
        stored: [onTag],
        read: [...busy, onMain],
        groups: [MAIN, { kind: 'pattern', pattern: 'v*' }],
    });

    expect(merged.slice(-2).map(entry => entry.id)).toEqual([2, 1]);
    expect(merged).toHaveLength(WORKFLOW_RUNS_KEPT + 7);
});

function run(id: number, conclusion: string | null, hour: number, overrides: Partial<GitHubWorkflowRun> = {}) {
    const created = new Date(Date.UTC(2026, 10, 1) + hour * 60 * 60_000);
    const entry: GitHubWorkflowRun = {
        id,
        workflowId: 1,
        runNumber: id,
        headBranch: 'main',
        event: 'push',
        status: conclusion === null ? 'in_progress' : 'completed',
        conclusion,
        createdAt: created.toISOString(),
        htmlUrl: `https://github.com/acme/web/actions/runs/${id}`,
        headSha: 'abc',
        ...overrides,
    };
    return entry;
}
