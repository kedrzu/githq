/// <reference types="bun" />
import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { expect, test } from 'bun:test';

import type { RepositoryWorkflows, StoredWorkflow, WorkflowRefSettings } from '../WorkflowTypes.js';
import { getRepositoryWorkflowState } from './getRepositoryWorkflowState.js';

const DEFAULT_REFS: WorkflowRefSettings = { countDefaultBranch: true, patterns: [] };
const HOUR = 60 * 60 * 1000;
/** 2026-11-02T12:00:00Z. */
const NOW = Date.parse('2026-11-02T12:00:00Z');

test('a repository not read yet, or one GitHub shows nothing of, is neither healthy nor counted', () => {
    const broken = [stored(workflow(1), [run(1, 'failure', '2026-11-02T11:00:00Z')])];

    expect(getRepositoryWorkflowState(repository(broken, { readAt: null }), DEFAULT_REFS, NOW)).toEqual({
        status: 'unread',
        workflows: [],
        brokenCount: 0,
        newestBreakAt: null,
        hasNewBreak: false,
    });
    expect(
        getRepositoryWorkflowState(
            repository(broken, { unavailable: { reason: 'refused', status: 403 } }),
            DEFAULT_REFS,
            NOW,
        ),
    ).toMatchObject({ status: 'unavailable', workflows: [], brokenCount: 0 });
});

test('a cancelled or skipped run after a failure keeps the workflow broken', () => {
    const failure = run(1, 'failure', '2026-11-02T08:00:00Z');
    const state = getRepositoryWorkflowState(
        repository([
            stored(workflow(1), [
                run(3, 'skipped', '2026-11-02T10:00:00Z'),
                run(2, 'cancelled', '2026-11-02T09:00:00Z'),
                failure,
            ]),
        ]),
        DEFAULT_REFS,
        NOW,
    );

    expect(state.workflows[0]).toMatchObject({ state: 'broken', latestFailedRun: failure });
    expect(state.brokenCount).toBe(1);
});

test('the break starts at the oldest failure after the last pass, and is new for a day', () => {
    const latestFailure = run(5, 'timed_out', '2026-11-02T10:00:00Z');
    const state = getRepositoryWorkflowState(
        repository([
            stored(workflow(1), [
                latestFailure,
                run(4, 'cancelled', '2026-11-02T09:00:00Z'),
                run(3, 'failure', '2026-11-02T08:00:00Z'),
                run(2, 'success', '2026-11-02T07:00:00Z'),
                run(1, 'failure', '2026-11-02T06:00:00Z'),
            ]),
        ]),
        DEFAULT_REFS,
        NOW,
    );

    expect(state.workflows[0]).toMatchObject({
        state: 'broken',
        breakStartedAt: Date.parse('2026-11-02T08:00:00Z'),
        isNew: true,
        latestFailedRun: latestFailure,
    });
    expect(state).toMatchObject({ newestBreakAt: Date.parse('2026-11-02T08:00:00Z'), hasNewBreak: true });
});

test('with no pass stored, the break starts at the oldest failure stored, and after a day is no longer new', () => {
    const state = getRepositoryWorkflowState(
        repository([
            stored(workflow(1), [
                run(2, 'failure', '2026-10-31T10:00:00Z'),
                run(1, 'startup_failure', '2026-10-30T10:00:00Z'),
            ]),
        ]),
        DEFAULT_REFS,
        NOW,
    );

    expect(state.workflows[0]).toMatchObject({ breakStartedAt: Date.parse('2026-10-30T10:00:00Z'), isNew: false });
    expect(state).toMatchObject({ brokenCount: 1, hasNewBreak: false });
});

test('a pass after a failure heals the workflow; no verdict leaves it unknown', () => {
    const state = getRepositoryWorkflowState(
        repository([
            stored(workflow(1), [run(2, 'success', '2026-11-02T10:00:00Z'), run(1, 'failure', '2026-11-02T09:00:00Z')]),
            stored(workflow(2), [run(3, 'cancelled', '2026-11-02T10:00:00Z')]),
            stored(workflow(3), []),
        ]),
        DEFAULT_REFS,
        NOW,
    );

    expect(state.workflows.map(entry => entry.state)).toEqual(['passing', 'unknown', 'unknown']);
    expect(state.workflows[0]).toMatchObject({ breakStartedAt: null, isNew: false, latestFailedRun: null });
    expect(state).toMatchObject({ status: 'read', brokenCount: 0, newestBreakAt: null, hasNewBreak: false });
});

test.each(['disabled_manually', 'disabled_inactivity', 'disabled_fork', 'deleted'])(
    'a workflow %p never counts, failed as it may be',
    workflowState => {
        const state = getRepositoryWorkflowState(
            repository([stored(workflow(1, { state: workflowState }), [run(1, 'failure', '2026-11-02T10:00:00Z')])]),
            DEFAULT_REFS,
            NOW,
        );

        expect(state.workflows[0]).toMatchObject({ state: 'disabled', breakStartedAt: null, latestFailedRun: null });
        expect(state.brokenCount).toBe(0);
    },
);

test('runs started by a pull request never count, on the default branch too', () => {
    const state = getRepositoryWorkflowState(
        repository([
            stored(workflow(1), [
                run(2, 'failure', '2026-11-02T10:00:00Z', { event: 'pull_request_target' }),
                run(1, 'success', '2026-11-02T09:00:00Z'),
            ]),
        ]),
        DEFAULT_REFS,
        NOW,
    );

    expect(state.workflows[0]).toMatchObject({ state: 'passing' });
    expect(state.workflows[0]?.lastRuns.map(entry => entry.id)).toEqual([1]);
});

test('only refs that count are read: a failure on a feature branch lights nothing, a pattern lights a tag', () => {
    const repo = repository([
        stored(workflow(1), [
            run(3, 'failure', '2026-11-02T10:00:00Z', { headBranch: 'v0.1.0-rc.1' }),
            run(2, 'failure', '2026-11-02T09:00:00Z', { headBranch: 'feature/x' }),
            run(1, 'success', '2026-11-02T08:00:00Z'),
        ]),
    ]);

    expect(getRepositoryWorkflowState(repo, DEFAULT_REFS, NOW).brokenCount).toBe(0);
    expect(getRepositoryWorkflowState(repo, { countDefaultBranch: true, patterns: ['v*'] }, NOW)).toMatchObject({
        brokenCount: 1,
        newestBreakAt: Date.parse('2026-11-02T10:00:00Z'),
    });
    expect(
        getRepositoryWorkflowState(repo, { countDefaultBranch: false, patterns: [] }, NOW).workflows[0],
    ).toMatchObject({ state: 'unknown', lastRuns: [] });
});

test('the strip holds the latest 5 counted runs oldest first, and a run in progress shows', () => {
    const runs = [1, 2, 3, 4, 5, 6].map(id => run(id, 'failure', `2026-11-02T0${id}:00:00Z`));
    const running = run(7, null, '2026-11-02T07:00:00Z', { status: 'in_progress' });
    const state = getRepositoryWorkflowState(repository([stored(workflow(1), [running, ...runs])]), DEFAULT_REFS, NOW);

    expect(state.workflows[0]?.lastRuns.map(entry => entry.id)).toEqual([3, 4, 5, 6, 7]);
    expect(state.workflows[0]).toMatchObject({ state: 'broken', runningRun: running });
});

test('a workflow GitHub generates counts like any other and says so', () => {
    const state = getRepositoryWorkflowState(
        repository([
            stored(workflow(1, { path: 'dynamic/pages/pages-build-deployment' }), [
                run(1, 'failure', '2026-11-02T10:00:00Z'),
            ]),
            stored(workflow(2), [run(2, 'failure', '2026-11-01T10:00:00Z')]),
        ]),
        DEFAULT_REFS,
        NOW,
    );

    expect(state.workflows.map(entry => entry.generated)).toEqual([true, false]);
    expect(state).toMatchObject({
        brokenCount: 2,
        newestBreakAt: Date.parse('2026-11-02T10:00:00Z'),
        hasNewBreak: true,
    });
});

function repository(workflows: StoredWorkflow[], overrides: Partial<RepositoryWorkflows> = {}): RepositoryWorkflows {
    return {
        nameWithOwner: 'kedrzu/githq',
        defaultBranch: 'main',
        repositoryEtag: '"repo"',
        runsEtag: '"runs"',
        workflowsEtag: '"workflows"',
        workflows,
        readAt: NOW - HOUR,
        unavailable: null,
        ...overrides,
    };
}

function stored(entry: GitHubWorkflow, runs: GitHubWorkflowRun[]): StoredWorkflow {
    return { workflow: entry, runs, etags: {} };
}

function workflow(id: number, overrides: Partial<GitHubWorkflow> = {}): GitHubWorkflow {
    return {
        id,
        name: `Workflow ${id}`,
        path: `.github/workflows/w${id}.yml`,
        state: 'active',
        htmlUrl: `https://github.com/kedrzu/githq/actions/workflows/w${id}.yml`,
        ...overrides,
    };
}

function run(
    id: number,
    conclusion: string | null,
    createdAt: string,
    overrides: Partial<GitHubWorkflowRun> = {},
): GitHubWorkflowRun {
    return {
        id,
        workflowId: 1,
        runNumber: id,
        headBranch: 'main',
        event: 'push',
        status: 'completed',
        conclusion,
        createdAt,
        htmlUrl: `https://github.com/kedrzu/githq/actions/runs/${id}`,
        headSha: 'abc',
        ...overrides,
    };
}
