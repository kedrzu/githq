/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { sampleRepositoryWorkflows } from '@/testing/sampleWorkflows.js';
import type { SampleWorkflowParams } from '@/testing/sampleWorkflows.js';

import { buildBrokenWorkflows } from './buildBrokenWorkflows.js';

const WEBAPP = 'fitloop/webapp';
const API = 'fitloop/api';
const MDLINT = 'mlaine/mdlint';
const TASKLET = 'mlaine/tasklet';

/** Passed a day ago, then failed `ago`. */
function brokenSince(id: number, name: string, ago: SampleWorkflowParams['runs'][number]['ago']): SampleWorkflowParams {
    return {
        id,
        name,
        runs: [
            { conclusion: 'success', ago: '30d' },
            { conclusion: 'failure', ago },
        ],
    };
}

test('broken workflows are grouped by how new the break is, not by repository, the newest break first', () => {
    const broken = buildBrokenWorkflows([
        sampleRepositoryWorkflows({
            nameWithOwner: WEBAPP,
            workflows: [
                brokenSince(1, 'Release', '4d'),
                brokenSince(2, 'Deploy', '3h'),
                { id: 3, name: 'Probe', runs: [{ conclusion: 'success', ago: '1h' }] },
            ],
        }),
        sampleRepositoryWorkflows({
            nameWithOwner: MDLINT,
            workflows: [brokenSince(4, 'CI', '1h'), brokenSince(5, 'Nightly', '2d')],
        }),
    ]);

    expect(broken.fresh.map(entry => [entry.nameWithOwner, entry.workflow.workflow.name])).toEqual([
        [MDLINT, 'CI'],
        [WEBAPP, 'Deploy'],
    ]);
    expect(broken.ongoing.map(entry => [entry.nameWithOwner, entry.workflow.workflow.name])).toEqual([
        [MDLINT, 'Nightly'],
        [WEBAPP, 'Release'],
    ]);
    expect(broken).toMatchObject({ brokenCount: 4, brokenRepositoryCount: 2, readCount: 2 });
});

test('a row names the ref its latest failure ran on and is keyed by repository and workflow', () => {
    const [entry] = buildBrokenWorkflows([
        sampleRepositoryWorkflows({ nameWithOwner: WEBAPP, workflows: [brokenSince(2, 'Deploy', '3h')] }),
    ]).fresh;

    expect(entry).toMatchObject({
        key: `${WEBAPP}#2`,
        gitRef: { name: 'main', kind: 'branch' },
        moreRefCount: 0,
    });
    expect(entry?.workflow.latestFailedRun?.htmlUrl).toBe(`https://github.com/${WEBAPP}/actions/runs/2002`);
});

test('repositories not read yet are listed apart and claimed neither broken nor healthy', () => {
    const broken = buildBrokenWorkflows([
        sampleRepositoryWorkflows({ nameWithOwner: TASKLET, unread: true }),
        sampleRepositoryWorkflows({ nameWithOwner: MDLINT, workflows: [brokenSince(5, 'Nightly', '2d')] }),
        sampleRepositoryWorkflows({ nameWithOwner: WEBAPP, unread: true }),
    ]);

    expect(broken.unread).toEqual([TASKLET, WEBAPP]);
    expect(broken).toMatchObject({ brokenCount: 1, readCount: 1 });
});

test('repositories GitHub shows nothing of are under "Can\'t tell", out of the total', () => {
    const broken = buildBrokenWorkflows([
        sampleRepositoryWorkflows({
            nameWithOwner: API,
            workflows: [brokenSince(6, 'Deploy', '3h')],
            unavailable: { reason: 'disabled', status: 404 },
        }),
    ]);

    expect(broken.unavailable).toEqual([{ nameWithOwner: API, unavailable: { reason: 'disabled', status: 404 } }]);
    expect(broken).toMatchObject({ fresh: [], ongoing: [], brokenCount: 0, brokenRepositoryCount: 0, readCount: 0 });
});

test('a repository with no workflows, or none broken, is not listed', () => {
    const broken = buildBrokenWorkflows([
        sampleRepositoryWorkflows({ nameWithOwner: TASKLET }),
        sampleRepositoryWorkflows({
            nameWithOwner: WEBAPP,
            workflows: [
                { id: 1, name: 'Probe', runs: [{ conclusion: 'success', ago: '1h' }] },
                { id: 2, name: 'Backup', state: 'disabled_manually', runs: [{ conclusion: 'failure', ago: '1h' }] },
            ],
        }),
    ]);

    expect(broken).toMatchObject({ fresh: [], ongoing: [], unread: [], unavailable: [], brokenCount: 0, readCount: 2 });
});
