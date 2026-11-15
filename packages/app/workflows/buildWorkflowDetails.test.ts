/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import type { GitHubWorkflowFileParse } from '@githq/github/workflows/parseWorkflowFile.js';
import { assertValue } from '@nzyme/utils/assert.js';

import { SAMPLE_WORKFLOWS_NOW, sampleStoredWorkflows, sampleWorkflowRuns } from '@/testing/sampleWorkflows.js';
import type { SampleRun, SampleWorkflowParams } from '@/testing/sampleWorkflows.js';

import { buildWorkflowDetails } from './buildWorkflowDetails.js';
import type { WorkflowCountedRef, WorkflowDetailsFile } from './buildWorkflowDetails.js';
import type { WorkflowFileRead } from './WorkflowFileStore.js';
import { getRepositoryWorkflowState } from './utils/getRepositoryWorkflowState.js';

const PARSED: GitHubWorkflowFileParse = {
    kind: 'parsed',
    file: {
        triggers: [{ event: 'push', branches: ['main'], tags: ['v*'] }],
        dispatch: null,
        callOnly: false,
    },
};
const READ: WorkflowFileRead = { parse: PARSED, status: 'idle' };

test('counts on each counted ref with its state and the latest agreeing runs, the runs read on demand included', () => {
    const deploy: SampleWorkflowParams = {
        id: 1,
        name: 'Deploy',
        runs: [
            { conclusion: 'success', ago: '5d' },
            { conclusion: 'failure', ago: '4d' },
            { conclusion: 'cancelled', ago: '3d' },
            { conclusion: 'failure', ago: '2d' },
        ],
    };
    // Read on demand: a newer failure the sync has not kept yet.
    const loaded = sampleWorkflowRuns({ ...deploy, runs: [{ conclusion: 'failure', ago: '1h' }], firstRun: 10 });

    const details = build(deploy, READ, loaded);

    const expected: WorkflowCountedRef[] = [
        {
            group: { kind: 'defaultBranch', branch: 'main' },
            state: 'broken',
            refKind: 'branch',
            streak: { verdict: 'failed', since: runOf(deploy, 1), count: 3 },
        },
        // No run on a tag yet; the file's trigger tells the pattern is a tag's.
        { group: { kind: 'pattern', pattern: 'v*' }, state: 'unknown', refKind: 'tag', streak: null },
    ];
    expect(details.countsOn).toEqual(expected);
    expect(details.lastSuccess).toEqual(runOf(deploy, 0));
});

test('the typical run is the median of the latest 20 successes; the running run is the latest not finished', () => {
    const runs: SampleRun[] = [
        // Older than the latest 20 successes: not counted.
        { conclusion: 'success', ago: '30d', seconds: 9000 },
        { conclusion: 'success', ago: '29d', seconds: 9000 },
        ...Array.from({ length: 20 }, (_, index): SampleRun => ({
            conclusion: 'success',
            ago: `${20 - index}d`,
            seconds: 60 + index * 10,
        })),
        { conclusion: 'failure', ago: '2h', seconds: 5 },
        { conclusion: null, ago: '3m' },
    ];
    const deploy: SampleWorkflowParams = { id: 1, name: 'Deploy', runs };

    const details = build(deploy, READ, []);

    // 60 s, 70 s, … 250 s: the middle two are 150 s and 160 s.
    expect(details.typicalDurationMs).toBe(155_000);
    expect(details.running).toEqual(runOf(deploy, 23));
    expect(build({ ...deploy, runs: [{ conclusion: 'failure', ago: '1d' }] }, READ, []).typicalDurationMs).toBeNull();
});

test.each<[string, WorkflowFileRead, WorkflowDetailsFile['kind']]>([
    ['not read yet', { parse: null, status: 'idle' }, 'loading'],
    ['being read', { parse: null, status: 'reading' }, 'loading'],
    ['refused', { parse: null, status: 'failed' }, 'failed'],
    ['refused when read again', { parse: { kind: 'notYaml' }, status: 'failed' }, 'notYaml'],
])('the file %s tells %s', (_, file, kind) => {
    expect(build({ id: 1, name: 'Deploy', runs: [] }, file, []).file.kind).toBe(kind);
});

test('a workflow GitHub generates has no file, whatever was read', () => {
    const pages = { id: 2, name: 'Pages', path: 'dynamic/pages/pages-build-deployment', runs: [] };

    const details = build(pages, { parse: { kind: 'missing' }, status: 'idle' }, []);

    expect(details).toMatchObject({ generated: true, active: true, file: { kind: 'generated' } });
});

function build(params: SampleWorkflowParams, file: WorkflowFileRead, runs: readonly GitHubWorkflowRun[]) {
    const stored = assertValue(sampleStoredWorkflows({ nameWithOwner: 'fitloop/webapp', workflows: [params] }));
    const state = getRepositoryWorkflowState(stored, { defaultBranch: true, refs: ['v*'] }, SAMPLE_WORKFLOWS_NOW);
    return buildWorkflowDetails({ stored, state: assertValue(state.workflows[0]), file, runs });
}

/** The sample's run at `index` of its runs, oldest first. */
function runOf(params: SampleWorkflowParams, index: number) {
    return assertValue(sampleWorkflowRuns(params).toReversed()[index]);
}
