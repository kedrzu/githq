/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { SAMPLE_TAB_WORKFLOWS, SAMPLE_WORKFLOWS_NOW, sampleStoredWorkflows } from '@/testing/sampleWorkflows.js';
import type { SampleRepositoryParams } from '@/testing/sampleWorkflows.js';

import type { RepositoryWorkflowList } from './buildRepositoryWorkflows.js';
import { buildRepositoryWorkflows } from './buildRepositoryWorkflows.js';
import type { WorkflowRefSettings } from './WorkflowTypes.js';

const WEBAPP = 'fitloop/webapp';
const DEFAULT: WorkflowRefSettings = { defaultBranch: true, refs: [] };
const OFF: WorkflowRefSettings = { defaultBranch: false, refs: [] };

function build(repository: Omit<SampleRepositoryParams, 'nameWithOwner'>, settings = DEFAULT) {
    return buildRepositoryWorkflows({
        stored: sampleStoredWorkflows({ nameWithOwner: WEBAPP, ...repository }),
        settings,
        now: SAMPLE_WORKFLOWS_NOW,
    });
}

function namesByGroup(list: RepositoryWorkflowList) {
    return list.groups.map(group => [group.kind, group.rows.map(row => row.workflow.workflow.name)]);
}

test('every workflow is a row, passing and disabled too, in the groups of the tab; a generated one is a plain row', () => {
    const list = build({ workflows: SAMPLE_TAB_WORKFLOWS });

    expect(namesByGroup(list)).toEqual([
        ['broken', ['Deploy']],
        ['pullRequestsOnly', ['CLA']],
        ['noAlerts', ['Release', 'Nightly e2e']],
        ['passing', ['Probe', 'Dependabot Updates']],
        ['disabled', ['Nightly backup']],
    ]);
    expect(list).toMatchObject({ status: 'read', count: 1, alertsOff: false, reading: false });
    expect(list.alerts).toEqual({ defaultBranch: true, defaultBranchName: 'main', patterns: [] });
});

test('a workflow only pull requests ran lights nothing and counts the failures among its last runs', () => {
    const [row] =
        build({ workflows: SAMPLE_TAB_WORKFLOWS }).groups.find(group => group.kind === 'pullRequestsOnly')?.rows ?? [];

    expect(row).toMatchObject({ standing: { kind: 'pullRequestsOnly', failedCount: 1 }, gitRef: null });
    expect(row?.runs).toHaveLength(3);
});

test('a failure on a ref without alerts names that ref and its kind; with a pattern on it, the workflow is broken there', () => {
    const noAlerts =
        build({ workflows: SAMPLE_TAB_WORKFLOWS }).groups.find(group => group.kind === 'noAlerts')?.rows ?? [];

    expect(noAlerts.map(row => row.standing)).toEqual([
        { kind: 'noAlerts', ref: { name: 'v0.1.0-rc.3', kind: 'tag' }, alertsOff: false },
        { kind: 'noAlerts', ref: { name: 'staging', kind: 'branch' }, alertsOff: false },
    ]);

    const withTags = build({ workflows: SAMPLE_TAB_WORKFLOWS }, { defaultBranch: true, refs: ['v*'] });
    expect(namesByGroup(withTags)[0]).toEqual(['broken', ['Deploy', 'Release']]);
    expect(withTags.groups[0]?.rows[1]?.gitRef).toEqual({ name: 'v*', kind: 'tag' });
    expect(withTags.count).toBe(2);
});

test('a failure on no named ref is under No alerts, not passing, with no ref to name', () => {
    const list = build({
        workflows: [
            {
                id: 1,
                name: 'Detached',
                runs: [
                    { conclusion: 'success', ago: '2d', branch: 'staging' },
                    { conclusion: 'failure', ago: '1h', branch: null },
                ],
            },
        ],
    });

    expect(namesByGroup(list)).toEqual([['noAlerts', ['Detached']]]);
    expect(list.groups[0]?.rows[0]).toMatchObject({
        standing: { kind: 'noAlerts', ref: null, alertsOff: false },
        gitRef: null,
    });
});

test('with alerts off nothing is broken and the tab has no count: every failure is under No alerts', () => {
    const list = build({ workflows: SAMPLE_TAB_WORKFLOWS }, OFF);

    // W14: the failures first, before the calm rows.
    expect(list.groups.map(group => group.kind)).toEqual(['noAlerts', 'pullRequestsOnly', 'passing', 'disabled']);
    expect(namesByGroup(list)[0]).toEqual(['noAlerts', ['Deploy', 'Release', 'Nightly e2e']]);
    expect(list.groups[0]?.rows[0]?.standing).toMatchObject({ kind: 'noAlerts', alertsOff: true });
    expect(list).toMatchObject({ alertsOff: true, count: null });
    expect(list.alerts).toEqual({ defaultBranch: false, defaultBranchName: 'main', patterns: [] });
});

test('runs not read yet: the rows have no verdict and an empty strip, what is known is so far, and the count is a dash', () => {
    const list = build({
        workflows: [SAMPLE_TAB_WORKFLOWS[0], { id: 9, name: 'Test', runs: [] }].filter(w => w !== undefined),
    });

    expect(namesByGroup(list)).toEqual([
        ['broken', ['Deploy']],
        ['notKnown', ['Test']],
    ]);
    expect(list.groups[1]?.rows[0]).toMatchObject({ standing: { kind: 'notKnown', reading: true }, runs: [] });
    expect(list).toMatchObject({ reading: true, count: 'unknown' });
});

test('a workflow read with no verdict is not known, but not being read', () => {
    const list = build({
        workflows: [
            { id: 9, name: 'Test', runs: [], read: true },
            { id: 10, name: 'Lint', runs: [{ conclusion: 'cancelled', ago: '1h' }] },
        ],
    });

    expect(namesByGroup(list)).toEqual([['notKnown', ['Test', 'Lint']]]);
    expect(list.groups[0]?.rows.map(row => row.standing)).toEqual([
        { kind: 'notKnown', reading: false },
        { kind: 'notKnown', reading: false },
    ]);
    expect(list).toMatchObject({ reading: false, count: 0 });
});

test('not read at all: no rows and a dash; no workflows: no count', () => {
    expect(build({ unread: true })).toMatchObject({ status: 'unread', groups: [], count: 'unknown' });
    expect(build({ workflows: [] })).toMatchObject({ status: 'read', groups: [], count: null });
});

test('Actions unavailable: the last known rows stay, the count is a dash', () => {
    const list = build({ workflows: SAMPLE_TAB_WORKFLOWS, unavailable: { reason: 'refused', status: 403 } });

    expect(list).toMatchObject({
        status: 'unavailable',
        unavailable: { reason: 'refused', status: 403 },
        count: 'unknown',
    });
    expect(list.groups.flatMap(group => group.rows)).toHaveLength(SAMPLE_TAB_WORKFLOWS.length);
});

test('broken rows show the newest break first; a pass on another ref hides nothing', () => {
    const list = build(
        {
            workflows: [
                {
                    id: 1,
                    name: 'Old',
                    runs: [
                        { conclusion: 'success', ago: '9d' },
                        { conclusion: 'failure', ago: '4d' },
                    ],
                },
                {
                    id: 2,
                    name: 'Fresh',
                    runs: [
                        { conclusion: 'failure', ago: '2h' },
                        { conclusion: 'success', ago: '1h', branch: 'staging' },
                    ],
                },
            ],
        },
        DEFAULT,
    );

    expect(namesByGroup(list)).toEqual([['broken', ['Fresh', 'Old']]]);
    expect(list.count).toBe(2);
});

test('a failure on one ref stands under No alerts, whatever passed later on another', () => {
    const list = build(
        {
            workflows: [
                {
                    id: 1,
                    name: 'Deploy',
                    runs: [
                        { conclusion: 'failure', ago: '2h' },
                        { conclusion: 'success', ago: '1h', branch: 'chore/x' },
                    ],
                },
            ],
        },
        OFF,
    );

    expect(namesByGroup(list)).toEqual([['noAlerts', ['Deploy']]]);
    expect(list.groups[0]?.rows[0]?.gitRef?.name).toBe('main');
});

test('a ref that failed and then passed no longer stands under No alerts', () => {
    const list = build(
        {
            workflows: [
                {
                    id: 1,
                    name: 'Deploy',
                    runs: [
                        { conclusion: 'failure', ago: '2h', branch: 'chore/x' },
                        { conclusion: 'success', ago: '1h', branch: 'chore/x' },
                    ],
                },
            ],
        },
        OFF,
    );

    expect(namesByGroup(list)).toEqual([['passing', ['Deploy']]]);
});

test('a workflow only comments ran, such as CLA, is pull requests only', () => {
    const list = build({
        workflows: [{ id: 1, name: 'CLA', runs: [{ conclusion: 'failure', ago: '1h', event: 'issue_comment' }] }],
    });

    expect(namesByGroup(list)).toEqual([['pullRequestsOnly', ['CLA']]]);
});

test('a run being re-run counts by the verdict it had: a pass keeps the row passing', () => {
    const list = build({
        workflows: [
            {
                id: 1,
                name: 'Only run',
                runs: [{ conclusion: null, ago: '1h', beforeRerun: 'success' }],
            },
        ],
    });

    expect(namesByGroup(list)).toEqual([['passing', ['Only run']]]);
    expect(list.groups[0]?.rows[0]?.gitRef).toEqual({ name: 'main', kind: 'branch' });
});

test('a pull requests’ run being re-run still counts as the failure it was', () => {
    const list = build({
        workflows: [
            {
                id: 1,
                name: 'CLA',
                runs: [
                    { conclusion: 'success', ago: '3h', event: 'pull_request', branch: 'a' },
                    { conclusion: null, ago: '1h', event: 'pull_request', branch: 'b', beforeRerun: 'failure' },
                ],
            },
        ],
    });

    expect(list.groups[0]?.rows[0]?.standing).toEqual({ kind: 'pullRequestsOnly', failedCount: 1 });
});
