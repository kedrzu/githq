/// <reference types="bun" />
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { expect, test } from 'bun:test';

import { isRunCounted } from './isRunCounted.js';
import type { IsRunCountedParams } from './isRunCounted.js';

const DEFAULT: IsRunCountedParams = { defaultBranch: 'main', countDefaultBranch: true, patterns: [] };

test('a run on the default branch counts by default, any other ref does not', () => {
    expect(isRunCounted(run('main', 'push'), DEFAULT)).toBe(true);
    expect(isRunCounted(run('feature/x', 'push'), DEFAULT)).toBe(false);
    expect(isRunCounted(run('v1.0', 'push'), DEFAULT)).toBe(false);
});

test.each(['pull_request', 'pull_request_target', 'pull_request_review'])(
    'a run started by %p never counts, even on a counted ref',
    event => {
        expect(isRunCounted(run('main', event), { ...DEFAULT, patterns: ['**'] })).toBe(false);
    },
);

test.each(['push', 'schedule', 'workflow_dispatch', 'issue_comment'])('a run started by %p counts', event => {
    expect(isRunCounted(run('main', event), DEFAULT)).toBe(true);
});

test('the default branch counts nothing when switched off or not known yet', () => {
    expect(isRunCounted(run('main', 'push'), { ...DEFAULT, countDefaultBranch: false })).toBe(false);
    expect(isRunCounted(run('main', 'push'), { ...DEFAULT, defaultBranch: null })).toBe(false);
});

test('a ref matching a pattern counts, the default branch off or on', () => {
    const params: IsRunCountedParams = { ...DEFAULT, countDefaultBranch: false, patterns: ['v*', 'release/*'] };

    expect(isRunCounted(run('v0.1.0-rc.1', 'push'), params)).toBe(true);
    expect(isRunCounted(run('release/1.2', 'push'), params)).toBe(true);
    expect(isRunCounted(run('release/1.2/hotfix', 'push'), params)).toBe(false);
    expect(isRunCounted(run('main', 'push'), params)).toBe(false);
});

test('a run on no ref never counts', () => {
    expect(isRunCounted(run(null, 'push'), { ...DEFAULT, patterns: ['**'] })).toBe(false);
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
    };
}
