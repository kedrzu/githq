/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { SAMPLE_WORKFLOWS_NOW, sampleStoredWorkflows } from '@/testing/sampleWorkflows.js';

import { buildWorkflowAlerts, previewPatternEdit } from './buildWorkflowAlerts.js';
import type { WorkflowRefSettings } from './WorkflowTypes.js';

/**
 * The design's fitloop/webapp (W7): Deploy broken on main, Release failed on the tag v0.1.0-rc.3 after passing on
 * rc.1 and rc.2, Deploy passed on the branch v2-experiment, Nightly e2e failed on staging.
 */
const STORED = sampleStoredWorkflows({
    nameWithOwner: 'fitloop/webapp',
    workflows: [
        {
            id: 1,
            name: 'Deploy',
            runs: [
                { conclusion: 'success', ago: '1d', branch: 'v2-experiment' },
                { conclusion: 'failure', ago: '2h' },
            ],
        },
        {
            id: 2,
            name: 'Release',
            runs: [
                { conclusion: 'success', ago: '3d', branch: 'v0.1.0-rc.1' },
                { conclusion: 'success', ago: '2d', branch: 'v0.1.0-rc.2' },
                { conclusion: 'failure', ago: '6h', branch: 'v0.1.0-rc.3' },
            ],
        },
        {
            id: 3,
            name: 'Nightly e2e',
            runs: [
                { conclusion: 'success', ago: '20h' },
                { conclusion: 'failure', ago: '5h', branch: 'staging' },
            ],
        },
        { id: 4, name: 'Probe', runs: [{ conclusion: 'success', ago: '1h' }] },
    ],
});

const DEFAULT: WorkflowRefSettings = { defaultBranch: true, refs: [] };
const WITH_V: WorkflowRefSettings = { defaultBranch: true, refs: ['v*'] };

function build(settings: WorkflowRefSettings) {
    return buildWorkflowAlerts({ stored: STORED, settings, now: SAMPLE_WORKFLOWS_NOW });
}

test('the default: the default branch with the workflows that run on it and its broken count; the other refs, the latest first, at most three', () => {
    const alerts = build(DEFAULT);

    expect(alerts.read).toBe(true);
    expect(alerts.alertsOff).toBe(false);
    expect(alerts.defaultBranch).toEqual({
        on: true,
        name: 'main',
        workflows: ['Deploy', 'Nightly e2e', 'Probe'],
        brokenCount: 1,
    });
    expect(alerts.patterns).toEqual([]);
    expect(alerts.otherRefs.map(entry => [entry.ref.name, entry.latest.workflow, entry.latest.verdict])).toEqual([
        ['staging', 'Nightly e2e', 'failed'],
        ['v0.1.0-rc.3', 'Release', 'failed'],
        ['v2-experiment', 'Deploy', 'passed'],
    ]);
});

test('a pattern lists its matches branches first, then tags the newest first, flags a catch of both kinds, and counts what is broken on them (W7)', () => {
    const alerts = build(WITH_V);
    const [pattern] = alerts.patterns;

    expect(pattern?.pattern).toBe('v*');
    expect(pattern?.matches.refs.map(ref => ref.name)).toEqual([
        'v2-experiment',
        'v0.1.0-rc.3',
        'v0.1.0-rc.2',
        'v0.1.0-rc.1',
    ]);
    expect(pattern?.matches).toMatchObject({
        branchCount: 1,
        tagCount: 3,
        workflows: ['Deploy', 'Release'],
        flagged: { kind: 'branch', names: ['v2-experiment'] },
    });
    expect(pattern?.brokenCount).toBe(1);
    // What v* counts is no longer among the refs without alerts.
    expect(alerts.otherRefs.map(entry => entry.ref.name)).toEqual(['staging']);
});

test('a pattern matching nothing yet has no refs and nothing broken (W8)', () => {
    const [pattern] = build({ defaultBranch: true, refs: ['release/*'] }).patterns;

    expect(pattern?.matches).toEqual({ refs: [], branchCount: 0, tagCount: 0, workflows: [], flagged: null });
    expect(pattern?.brokenCount).toBe(0);
});

test('the default branch off and no patterns: nothing raises alerts, and the default branch is among the refs without them (W9)', () => {
    const alerts = build({ defaultBranch: false, refs: [] });

    expect(alerts.alertsOff).toBe(true);
    expect(alerts.defaultBranch).toMatchObject({ on: false, name: 'main', brokenCount: null });
    // A failure there is what main says, though a pass came later.
    expect(alerts.otherRefs.map(entry => [entry.ref.name, entry.latest.workflow, entry.latest.verdict])).toEqual([
        ['main', 'Deploy', 'failed'],
        ['staging', 'Nightly e2e', 'failed'],
        ['v0.1.0-rc.3', 'Release', 'failed'],
    ]);
});

test('not read yet: no matches and no counts, not zeros (W10)', () => {
    const alerts = buildWorkflowAlerts({ stored: undefined, settings: WITH_V, now: SAMPLE_WORKFLOWS_NOW });

    expect(alerts.read).toBe(false);
    expect(alerts.defaultBranch).toEqual({ on: true, name: null, workflows: [], brokenCount: null });
    expect(alerts.patterns).toEqual([
        {
            pattern: 'v*',
            matches: { refs: [], branchCount: 0, tagCount: 0, workflows: [], flagged: null },
            brokenCount: null,
        },
    ]);
    expect(alerts.otherRefs).toEqual([]);
});

test('adding a pattern previews what it matches and what turns broken; nothing typed or one already listed saves nothing (W11)', () => {
    const preview = previewPatternEdit({ stored: STORED, settings: DEFAULT, index: null, value: ' v* ' });

    expect(preview.kind === 'preview' && preview.settings).toEqual(WITH_V);
    expect(preview.kind === 'preview' && preview.matches.branchCount).toBe(1);
    expect(preview.kind === 'preview' && preview.turnBroken).toEqual([
        {
            workflow: 'Release',
            ref: { name: 'v0.1.0-rc.3', kind: 'tag' },
            at: SAMPLE_WORKFLOWS_NOW - 6 * 60 * 60_000,
        },
    ]);
    expect(preview.kind === 'preview' && [preview.stopCounting, preview.stopMatching, preview.staysBroken]).toEqual([
        [],
        [],
        [],
    ]);

    expect(previewPatternEdit({ stored: STORED, settings: DEFAULT, index: null, value: '  ' })).toEqual({
        kind: 'empty',
    });
    expect(previewPatternEdit({ stored: STORED, settings: WITH_V, index: null, value: 'v*' })).toEqual({
        kind: 'duplicate',
    });
    // Its own value, being edited, is no duplicate.
    expect(previewPatternEdit({ stored: STORED, settings: WITH_V, index: 0, value: 'v*' }).kind).toBe('preview');
});

test('narrowing a pattern names the refs that stop counting, and the workflows that stay broken (W12)', () => {
    const preview = previewPatternEdit({ stored: STORED, settings: WITH_V, index: 0, value: 'v*.*.*' });

    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') {
        return;
    }

    expect(preview.settings.refs).toEqual(['v*.*.*']);
    expect(preview.matches.refs.map(ref => ref.name)).toEqual(['v0.1.0-rc.3', 'v0.1.0-rc.2', 'v0.1.0-rc.1']);
    expect(preview.turnBroken).toEqual([]);
    expect(preview.stopCounting).toEqual([]);
    expect(preview.stopMatching.map(ref => ref.name)).toEqual(['v2-experiment']);
    expect(preview.staysBroken).toEqual(['Release']);
});

test('a pattern that stops a broken workflow counting names it', () => {
    const preview = previewPatternEdit({ stored: STORED, settings: WITH_V, index: 0, value: 'release/*' });

    expect(preview.kind === 'preview' && preview.stopCounting).toEqual(['Release']);
    expect(preview.kind === 'preview' && preview.staysBroken).toEqual([]);
});
