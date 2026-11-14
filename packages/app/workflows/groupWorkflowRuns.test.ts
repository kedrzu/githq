/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import { groupWorkflowRuns } from './groupWorkflowRuns.js';
import type { GroupWorkflowRunsParams, WorkflowRunGroupLabel } from './groupWorkflowRuns.js';
import type { WorkflowRefGroup } from './WorkflowTypes.js';

const MAIN: WorkflowRefGroup = { kind: 'defaultBranch', branch: 'main' };
const RELEASES: WorkflowRefGroup = { kind: 'pattern', pattern: 'v*' };
const ANY: WorkflowRefGroup = { kind: 'pattern', pattern: '**' };
/** Thursday 12 November 2026, 10:00 local time. */
const NOW = new Date(2026, 10, 12, 10, 0).getTime();

test('by status: in progress, failed, succeeded, cancelled, then the rest, each keeping the runs’ order; empty ones left out', () => {
    const runs = [
        run(1, { status: 'queued', conclusion: null }),
        run(2, { conclusion: 'timed_out' }),
        run(3, { conclusion: 'skipped' }),
        run(4, { status: 'waiting', conclusion: null }),
        run(5, { conclusion: 'failure' }),
        run(6, { conclusion: 'neutral' }),
    ];

    expect(summarize({ runs, groupBy: 'status' })).toEqual([
        [{ kind: 'status', status: 'inProgress' }, [1, 4]],
        [{ kind: 'status', status: 'failed' }, [2, 5]],
        [{ kind: 'status', status: 'other' }, [3, 6]],
    ]);
});

test('by ref: the counted groups in their order, a run counting in two going to the first, then other branches, other tags and pull requests', () => {
    const runs = [
        run(1, { headBranch: 'feature' }),
        run(2, { headBranch: 'main', event: 'pull_request' }),
        run(3, { headBranch: 'v1.2.0' }),
        run(4, { headBranch: 'nightly' }),
        run(5, { headBranch: null }),
        run(6, { headBranch: 'main' }),
    ];

    expect(summarize({ runs, groupBy: 'ref', refGroups: [RELEASES, MAIN], tags: ['v1.2.0', 'nightly'] })).toEqual([
        [{ kind: 'countedRef', group: RELEASES }, [3]],
        [{ kind: 'countedRef', group: MAIN }, [6]],
        [{ kind: 'otherBranches' }, [1, 5]],
        [{ kind: 'otherTags' }, [4]],
        [{ kind: 'pullRequests' }, [2]],
    ]);
    expect(summarize({ runs: runs.slice(5), groupBy: 'ref', refGroups: [MAIN, ANY] })).toEqual([
        [{ kind: 'countedRef', group: MAIN }, [6]],
    ]);
});

test('by day in local time: today, yesterday, earlier this week from Monday, older', () => {
    const runs = [
        run(1, { createdAt: local(12, 8) }),
        run(2, { createdAt: local(12, 0, 30) }),
        run(3, { createdAt: local(11, 23) }),
        run(4, { createdAt: local(10, 10) }),
        run(5, { createdAt: local(9, 0, 10) }),
        run(6, { createdAt: local(8, 23, 59) }),
    ];

    expect(summarize({ runs, groupBy: 'day' })).toEqual([
        [{ kind: 'day', day: 'today' }, [1, 2]],
        [{ kind: 'day', day: 'yesterday' }, [3]],
        [{ kind: 'day', day: 'thisWeek' }, [4, 5]],
        [{ kind: 'day', day: 'older' }, [6]],
    ]);
});

test('by actor: in the order of each one’s newest run, the runs credited to no one last', () => {
    const hubot = { login: 'hubot', avatarUrl: 'https://avatars.githubusercontent.com/hubot' };
    const mona = { login: 'monalisa', avatarUrl: 'https://avatars.githubusercontent.com/monalisa' };
    const runs = [run(1, { actor: null }), run(2, { actor: mona }), run(3, { actor: hubot }), run(4, { actor: mona })];

    expect(summarize({ runs, groupBy: 'actor' })).toEqual([
        [{ kind: 'actor', actor: mona }, [2, 4]],
        [{ kind: 'actor', actor: hubot }, [3]],
        [{ kind: 'actor', actor: null }, [1]],
    ]);
});

/** Each group as its label and its runs' ids. */
function summarize(params: Partial<GroupWorkflowRunsParams>): [WorkflowRunGroupLabel, number[]][] {
    return groupWorkflowRuns({ runs: [], groupBy: 'none', refGroups: [], tags: [], now: NOW, ...params }).map(group => [
        group.label,
        group.runs.map(entry => entry.id),
    ]);
}

/** An ISO time on a day of November 2026, local time. */
function local(day: number, hours: number, minutes = 0) {
    return new Date(2026, 10, day, hours, minutes).toISOString();
}

function run(id: number, overrides: Partial<GitHubWorkflowRun> = {}): GitHubWorkflowRun {
    return {
        id,
        workflowId: 1,
        runNumber: id,
        headBranch: 'main',
        event: 'push',
        status: 'completed',
        conclusion: 'success',
        createdAt: local(12, 9),
        htmlUrl: `https://github.com/acme/web/actions/runs/${id}`,
        headSha: `sha${id}`,
        displayTitle: `Run ${id}`,
        updatedAt: local(12, 9),
        actor: null,
        runAttempt: 1,
        ...overrides,
    };
}
