/// <reference types="bun" />
import { assertValue } from '@nzyme/utils/assert.js';
import { expect, test } from 'bun:test';

import { sampleStoredWorkflows, sampleWorkflowRuns } from '@/testing/sampleWorkflows.js';
import type { SampleWorkflowParams } from '@/testing/sampleWorkflows.js';

import { buildUnfoldedWorkflow } from './buildUnfoldedWorkflow.js';

const DEPLOY: SampleWorkflowParams = {
    id: 1,
    name: 'Deploy',
    runs: [
        { conclusion: 'success', ago: '3h', branch: 'v1.0' },
        { conclusion: 'failure', ago: '2h', branch: 'feature', event: 'pull_request' },
        { conclusion: 'success', ago: '1h' },
    ],
};
const STORED = assertValue(sampleStoredWorkflows({ nameWithOwner: 'acme/web', workflows: [DEPLOY] }));
/** Older runs read on demand, the newest of them one already kept. */
const OLDER = sampleWorkflowRuns({
    ...DEPLOY,
    firstRun: -2,
    runs: [
        { conclusion: 'success', ago: '2d', branch: 'staging' },
        { conclusion: 'failure', ago: '1d' },
        { conclusion: 'success', ago: '3h', branch: 'v1.0' },
    ],
});

test('the kept runs, then those read on demand, merged by id, the newest first; a pull request’s among them', () => {
    const unfolded = buildUnfoldedWorkflow({
        stored: STORED,
        workflowId: 1,
        ref: null,
        history: { runs: OLDER, status: 'reading', complete: false },
        anyRef: OLDER,
    });

    expect(unfolded.key).toBe('1');
    expect(unfolded.runs.map(line => [line.run.runNumber, line.ref?.name, line.ref?.kind, line.run.event])).toEqual([
        [202, 'main', 'branch', 'push'],
        [201, 'feature', 'branch', 'pull_request'],
        [200, 'v1.0', 'tag', 'push'],
        [199, 'main', 'branch', 'push'],
        [198, 'staging', 'branch', 'push'],
    ]);
    expect(unfolded.runs.map(line => line.key)).toEqual(['run:1003', 'run:1002', 'run:1001', 'run:1000', 'run:999']);
    expect(unfolded.refs).toEqual(['main', 'feature', 'v1.0', 'staging']);
    expect(unfolded).toMatchObject({ ref: null, status: 'reading', complete: false });
});

test('filtered by a ref: only its runs; the refs seen on any ref, and the one typed, are still offered', () => {
    const unfolded = buildUnfoldedWorkflow({
        stored: STORED,
        workflowId: 1,
        ref: 'release/2',
        history: { runs: [], status: 'idle', complete: true },
        anyRef: OLDER,
    });

    expect(unfolded.runs).toEqual([]);
    expect(unfolded.refs).toEqual(['main', 'feature', 'v1.0', 'staging', 'release/2']);

    const onMain = buildUnfoldedWorkflow({
        stored: STORED,
        workflowId: 1,
        ref: 'main',
        history: { runs: OLDER.filter(run => run.headBranch === 'main'), status: 'idle', complete: true },
        anyRef: [],
    });
    expect(onMain.runs.map(line => line.run.runNumber)).toEqual([202, 199]);
});
