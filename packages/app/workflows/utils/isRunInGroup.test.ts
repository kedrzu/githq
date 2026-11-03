/// <reference types="bun" />
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { expect, test } from 'bun:test';

import type { WorkflowRefGroup } from '../WorkflowTypes.js';
import { getRefGroups } from './getRefGroups.js';
import { isRunInGroup } from './isRunInGroup.js';

const MAIN: WorkflowRefGroup = { kind: 'defaultBranch', branch: 'main' };
const ANY: WorkflowRefGroup = { kind: 'pattern', pattern: '**' };

test('a run on the default branch counts in its group, any other ref does not', () => {
    expect(isRunInGroup(run('main', 'push'), MAIN)).toBe(true);
    expect(isRunInGroup(run('feature/x', 'push'), MAIN)).toBe(false);
    expect(isRunInGroup(run('v1.0', 'push'), MAIN)).toBe(false);
});

test.each(['pull_request', 'pull_request_target', 'pull_request_review', 'issue_comment'])(
    'a run started by %p never counts, in no group, even on a counted ref',
    event => {
        expect(isRunInGroup(run('main', event), MAIN)).toBe(false);
        expect(isRunInGroup(run('main', event), ANY)).toBe(false);
        expect(isRunInGroup(run('v1.0', event), { kind: 'pattern', pattern: 'v*' })).toBe(false);
    },
);

test.each(['push', 'schedule', 'workflow_dispatch'])('a run started by %p counts', event => {
    expect(isRunInGroup(run('main', event), MAIN)).toBe(true);
});

test('a ref matching a pattern counts in its group', () => {
    const tags: WorkflowRefGroup = { kind: 'pattern', pattern: 'v*' };
    const releases: WorkflowRefGroup = { kind: 'pattern', pattern: 'release/*' };

    expect(isRunInGroup(run('v0.1.0-rc.1', 'push'), tags)).toBe(true);
    expect(isRunInGroup(run('release/1.2', 'push'), releases)).toBe(true);
    expect(isRunInGroup(run('release/1.2/hotfix', 'push'), releases)).toBe(false);
    expect(isRunInGroup(run('main', 'push'), tags)).toBe(false);
});

test('a run on no ref never counts', () => {
    expect(isRunInGroup(run(null, 'push'), ANY)).toBe(false);
});

test('the groups: the default branch while it counts and is known, then each pattern once, in the user’s order', () => {
    expect(getRefGroups({ defaultBranch: true, refs: [] }, 'main')).toEqual([MAIN]);
    expect(getRefGroups({ defaultBranch: true, refs: ['v*', 'release/*', 'v*'] }, 'main')).toEqual([
        MAIN,
        { kind: 'pattern', pattern: 'v*' },
        { kind: 'pattern', pattern: 'release/*' },
    ]);
    expect(getRefGroups({ defaultBranch: true, refs: [] }, null)).toEqual([]);
    expect(getRefGroups({ defaultBranch: false, refs: [] }, 'main')).toEqual([]);
});

function run(headBranch: string | null, event: string): GitHubWorkflowRun {
    return {
        id: 1,
        workflowId: 7,
        runNumber: 1,
        headBranch,
        event,
        status: 'completed',
        conclusion: 'failure',
        createdAt: '2026-11-01T03:00:00Z',
        htmlUrl: 'https://github.com/kedrzu/githq/actions/runs/1',
        headSha: 'abc',
        displayTitle: 'Run',
        updatedAt: '2026-11-02T11:00:00Z',
    };
}
