/// <reference types="bun" />
import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { expect, test } from 'bun:test';

import type { RepositoryWorkflows, StoredWorkflow, WorkflowRefSettings } from '../WorkflowTypes.js';
import { getRepositoryWorkflowState } from './getRepositoryWorkflowState.js';

const DEFAULT_REFS: WorkflowRefSettings = { defaultBranch: true, refs: [] };
/** 2026-11-02T12:00:00Z. */
const NOW = Date.parse('2026-11-02T12:00:00Z');

test('a repository not read yet, or one GitHub shows nothing of, is neither healthy nor counted', () => {
    const broken = [stored(workflow(1), [run(1, 'failure', '2026-11-02T11:00:00Z')])];

    expect(getRepositoryWorkflowState(undefined, DEFAULT_REFS, NOW)).toEqual({
        status: 'unread',
        unavailable: null,
        reading: false,
        workflows: [],
        brokenCount: 0,
        hasNewBreak: false,
    });
    expect(
        getRepositoryWorkflowState(
            repository(broken, { unavailable: { reason: 'refused', status: 403 } }),
            DEFAULT_REFS,
            NOW,
        ),
    ).toMatchObject({
        status: 'unavailable',
        unavailable: { reason: 'refused', status: 403 },
        workflows: [],
        brokenCount: 0,
    });
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
        breakStartKnown: true,
        isNew: true,
        latestFailedRun: latestFailure,
    });
    expect(state).toMatchObject({ hasNewBreak: true });
});

test('with no pass stored, the break starts at the oldest failure stored, and after a day is no longer new, its whole history known', () => {
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

    expect(state.workflows[0]).toMatchObject({
        breakStartedAt: Date.parse('2026-10-30T10:00:00Z'),
        breakStartKnown: true,
        isNew: false,
    });
    expect(state).toMatchObject({ brokenCount: 1, hasNewBreak: false });
});

test('with no pass stored and more runs than one read returns, the break’s start is not known, so it never shows as new', () => {
    const failures = Array.from({ length: 10 }, (_, index) =>
        run(index + 1, 'failure', `2026-11-02T10:${String(index).padStart(2, '0')}:00Z`),
    );
    const state = getRepositoryWorkflowState(repository([stored(workflow(1), failures)]), DEFAULT_REFS, NOW);

    expect(state.workflows[0]).toMatchObject({ state: 'broken', breakStartKnown: false, isNew: false });
    expect(state).toMatchObject({ brokenCount: 1, hasNewBreak: false });
});

test('with fewer runs than one read returns the whole history is known: a first failure ever is new', () => {
    const state = getRepositoryWorkflowState(
        repository([stored(workflow(1), [run(1, 'failure', '2026-11-02T10:00:00Z')])]),
        DEFAULT_REFS,
        NOW,
    );

    expect(state.workflows[0]).toMatchObject({ state: 'broken', breakStartKnown: true, isNew: true });
    expect(state).toMatchObject({ brokenCount: 1, hasNewBreak: true });
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
    expect(state).toMatchObject({ status: 'read', brokenCount: 0, hasNewBreak: false });
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
    expect(getRepositoryWorkflowState(repo, { defaultBranch: true, refs: ['v*'] }, NOW)).toMatchObject({
        brokenCount: 1,
    });
    expect(getRepositoryWorkflowState(repo, { defaultBranch: false, refs: [] }, NOW).workflows[0]).toMatchObject({
        state: 'unknown',
        lastRuns: [],
    });
});

test('the strip holds the latest 5 counted runs oldest first, and a run in progress shows', () => {
    const runs = [1, 2, 3, 4, 5, 6].map(id => run(id, 'failure', `2026-11-02T0${id}:00:00Z`));
    const running = run(7, null, '2026-11-02T07:00:00Z', { status: 'in_progress' });
    const state = getRepositoryWorkflowState(repository([stored(workflow(1), [running, ...runs])]), DEFAULT_REFS, NOW);

    expect(state.workflows[0]?.lastRuns.map(entry => entry.id)).toEqual([3, 4, 5, 6, 7]);
    expect(state.workflows[0]).toMatchObject({ state: 'broken' });
    expect(state.workflows[0]?.lastRuns.at(-1)).toBe(running);
});

test('a run stored in progress but older than the strip shows no longer: its end was not read again', () => {
    const stale = run(1, null, '2026-11-01T01:00:00Z', { status: 'in_progress' });
    const runs = [2, 3, 4, 5, 6].map(id => run(id, 'success', `2026-11-02T0${id}:00:00Z`));
    const state = getRepositoryWorkflowState(repository([stored(workflow(1), [...runs, stale])]), DEFAULT_REFS, NOW);

    expect(state.workflows[0]?.lastRuns.map(entry => entry.id)).toEqual([2, 3, 4, 5, 6]);
    expect(state.workflows[0]).toMatchObject({ state: 'passing' });
});

test('a workflow GitHub generates counts like any other and says so', () => {
    const state = getRepositoryWorkflowState(
        repository([
            stored(workflow(1, { path: 'dynamic/pages/pages-build-deployment' }), [
                run(1, 'failure', '2026-11-02T10:00:00Z'),
                run(3, 'success', '2026-11-02T09:00:00Z'),
            ]),
            stored(workflow(2), [run(2, 'failure', '2026-11-01T10:00:00Z')]),
        ]),
        DEFAULT_REFS,
        NOW,
    );

    expect(state.workflows.map(entry => entry.generated)).toEqual([true, false]);
    expect(state).toMatchObject({
        brokenCount: 2,
        hasNewBreak: true,
    });
});

test('each group is judged on its own: a pass on the default branch never hides a failure on a pattern, nor one pattern another', () => {
    const tagFailure = run(2, 'failure', '2026-11-02T08:00:00Z', { headBranch: 'v0.1.0-rc.1' });
    const state = getRepositoryWorkflowState(
        repository([
            stored(workflow(1), [
                run(4, 'success', '2026-11-02T11:00:00Z'),
                run(3, 'success', '2026-11-02T10:00:00Z', { headBranch: 'release/1.2' }),
                tagFailure,
                run(1, 'failure', '2026-11-01T08:00:00Z', { headBranch: 'release/1.1' }),
            ]),
        ]),
        { defaultBranch: true, refs: ['v*', 'release/*'] },
        NOW,
    );

    expect(state.workflows[0]?.groups.map(group => [group.group, group.state])).toEqual([
        [{ kind: 'defaultBranch', branch: 'main' }, 'passing'],
        [{ kind: 'pattern', pattern: 'v*' }, 'broken'],
        // Under one pattern the latest run decides: release/1.2's pass hides release/1.1's failure (actions D1).
        [{ kind: 'pattern', pattern: 'release/*' }, 'passing'],
    ]);
    expect(state.workflows[0]).toMatchObject({
        state: 'broken',
        latestFailedRun: tagFailure,
        breakStartedAt: Date.parse('2026-11-02T08:00:00Z'),
    });
    expect(state.workflows[0]?.brokenGroups.map(group => group.failedRef)).toEqual([
        { name: 'v0.1.0-rc.1', kind: 'tag' },
    ]);
    // The strip: the latest 5 counted runs, across groups.
    expect(state.workflows[0]?.lastRuns.map(entry => entry.id)).toEqual([1, 2, 3, 4]);
    expect(state.brokenCount).toBe(1);
});

test('broken in two groups: the newest break is the one shown, the other counted apart, the workflow once', () => {
    const twice = getRepositoryWorkflowState(
        repository([
            stored(workflow(1), [
                run(3, 'failure', '2026-11-02T10:00:00Z', { headBranch: 'v0.1.0-rc.2' }),
                run(2, 'success', '2026-11-02T09:00:00Z', { headBranch: 'v0.1.0-rc.1' }),
                run(1, 'failure', '2026-10-30T10:00:00Z'),
            ]),
        ]),
        { defaultBranch: true, refs: ['v*'] },
        NOW,
    );
    expect(twice.workflows[0]?.brokenGroups.map(group => [group.group, group.failedRef])).toEqual([
        [
            { kind: 'pattern', pattern: 'v*' },
            { name: 'v0.1.0-rc.2', kind: 'tag' },
        ],
        [
            { kind: 'defaultBranch', branch: 'main' },
            { name: 'main', kind: 'branch' },
        ],
    ]);
    expect(twice.workflows[0]).toMatchObject({ breakStartedAt: Date.parse('2026-11-02T10:00:00Z'), isNew: true });
    expect(twice.brokenCount).toBe(1);
});

test('a group with no run with a verdict is unknown, never passing: the workflow passes only by a group that passed', () => {
    const state = getRepositoryWorkflowState(
        repository([
            stored(workflow(1), [
                run(2, 'cancelled', '2026-11-02T10:00:00Z', { headBranch: 'v0.1.0-rc.1' }),
                run(1, 'success', '2026-11-02T09:00:00Z'),
            ]),
        ]),
        { defaultBranch: true, refs: ['v*'] },
        NOW,
    );
    expect(state.workflows[0]?.groups.map(group => group.state)).toEqual(['passing', 'unknown']);
    expect(state.workflows[0]?.state).toBe('passing');

    const onlyTags = getRepositoryWorkflowState(
        repository([stored(workflow(1), [run(1, 'success', '2026-11-02T09:00:00Z')])]),
        { defaultBranch: false, refs: ['v*'] },
        NOW,
    );
    expect(onlyTags.workflows[0]).toMatchObject({ state: 'unknown', groups: [{ state: 'unknown' }] });
});

function repository(workflows: StoredWorkflow[], overrides: Partial<RepositoryWorkflows> = {}): RepositoryWorkflows {
    return {
        nameWithOwner: 'kedrzu/githq',
        defaultBranch: 'main',
        repositoryEtag: '"repo"',
        runsEtag: '"runs"',
        workflowsEtag: '"workflows"',
        tagsEtag: '"tags"',
        workflows,
        tags: ['v0.1.0-rc.1', 'v0.1.0-rc.2'],
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
        displayTitle: 'Run',
        updatedAt: '2026-11-02T11:00:00Z',
        ...overrides,
    };
}
