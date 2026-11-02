/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { sampleStoredWorkflows } from '@/testing/sampleWorkflows.js';

import { getKnownRefs } from './getKnownRefs.js';
import { previewWorkflowSettings } from './previewWorkflowSettings.js';

/** Release failed on rc.1, passed on rc.3; ran on a branch `v2-experiment` too. CI passes on main, fails on a PR. */
const STORED = sampleStoredWorkflows({
    nameWithOwner: 'kedrzu/githq',
    workflows: [
        {
            id: 1,
            name: 'Release',
            runs: [
                { conclusion: 'failure', ago: '3d', branch: 'v0.1.0-rc.1' },
                { conclusion: 'cancelled', ago: '2d', branch: 'v0.1.0-rc.2' },
                { conclusion: 'failure', ago: '1d', branch: 'v2-experiment' },
                { conclusion: 'success', ago: '2h', branch: 'v0.1.0-rc.3' },
            ],
        },
        {
            id: 2,
            name: 'CI',
            runs: [
                { conclusion: 'success', ago: '1h' },
                { conclusion: 'failure', ago: '30m', branch: 'v2-experiment' },
            ],
        },
    ],
});

test('the known refs: every ref a run was seen on, the latest first, with its kind and its workflows’ last verdict there', () => {
    const known = getKnownRefs(STORED);

    expect(known.map(ref => [ref.name, ref.kind])).toEqual([
        ['v2-experiment', 'branch'],
        ['main', 'branch'],
        ['v0.1.0-rc.3', 'tag'],
        ['v0.1.0-rc.2', 'tag'],
        ['v0.1.0-rc.1', 'tag'],
    ]);
    expect(known[0]).toMatchObject({
        latestRunAt: Date.parse('2026-11-02T11:30:00Z'),
        workflows: [
            { workflow: { name: 'Release' }, failed: true },
            { workflow: { name: 'CI' }, failed: true },
        ],
    });
    expect(known[3]?.workflows).toMatchObject([{ workflow: { name: 'Release' }, failed: false }]);
    expect(getKnownRefs(undefined)).toEqual([]);
});

test('a pattern shows the known refs it matches, branches and tags alike, or none; and what would turn broken or stop counting', () => {
    const preview = previewWorkflowSettings({
        stored: STORED,
        current: { defaultBranch: true, refs: [] },
        candidate: { defaultBranch: true, refs: ['v*', 'release/*'] },
    });

    expect(preview.patterns.map(entry => [entry.pattern, entry.refs.map(ref => `${ref.kind} ${ref.name}`)])).toEqual([
        ['v*', ['branch v2-experiment', 'tag v0.1.0-rc.3', 'tag v0.1.0-rc.2', 'tag v0.1.0-rc.1']],
        ['release/*', []],
    ]);
    // Under v*, Release's latest verdict is rc.3's pass; CI's is its failure on the branch v2-experiment.
    expect(preview.turnBroken.map(workflow => workflow.name)).toEqual(['CI']);
    expect(preview.stopCounting).toEqual([]);

    const narrowed = previewWorkflowSettings({
        stored: STORED,
        current: { defaultBranch: true, refs: ['v*'] },
        candidate: { defaultBranch: false, refs: ['v0.*'] },
    });
    expect(narrowed.stopCounting.map(workflow => workflow.name)).toEqual(['CI']);
    expect(narrowed.turnBroken).toEqual([]);
});

test('a repository not read yet matches nothing known', () => {
    expect(
        previewWorkflowSettings({
            stored: undefined,
            current: { defaultBranch: true, refs: [] },
            candidate: { defaultBranch: true, refs: ['v*'] },
        }),
    ).toEqual({ patterns: [{ pattern: 'v*', refs: [] }], turnBroken: [], stopCounting: [] });
});
