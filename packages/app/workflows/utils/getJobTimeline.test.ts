import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';
import { expect, test } from 'bun:test';

import { getJobTimeline } from './getJobTimeline.js';

const START = Date.parse('2026-11-02T10:00:00Z');
const NOW = START + 400_000;

test('each job’s bar starts and ends where it did between the first start and the last end, in the order they started', () => {
    const bars = getJobTimeline(
        [job(1, 'deploy', 300_000, 400_000), job(2, 'build', 0, 200_000), job(3, 'lint', 100_000, 140_000)],
        NOW,
    );

    expect(bars.map(bar => [bar.job.name, bar.offset, bar.length, bar.ms])).toEqual([
        ['build', 0, 0.5, 200_000],
        ['lint', 0.25, 0.1, 40_000],
        ['deploy', 0.75, 0.25, 100_000],
    ]);
});

test('a running job runs to now; one not started, or that never did, has no bar and comes last', () => {
    const bars = getJobTimeline(
        [
            job(1, 'waiting', null, null),
            job(2, 'build', 0, 100_000),
            job(3, 'test', 200_000, null),
            { ...job(4, 'cancelled', 50_000, null), status: 'completed' },
        ],
        NOW,
    );

    expect(bars.map(bar => [bar.job.name, bar.offset, bar.length, bar.ms])).toEqual([
        ['build', 0, 0.25, 100_000],
        ['test', 0.5, 0.5, 200_000],
        ['waiting', 0, 0, null],
        ['cancelled', 0, 0, null],
    ]);
});

function job(id: number, name: string, startedMs: number | null, completedMs: number | null): GitHubWorkflowJob {
    return {
        id,
        name,
        status:
            completedMs === null && startedMs !== null ? 'in_progress' : startedMs === null ? 'queued' : 'completed',
        conclusion: completedMs === null ? null : 'success',
        startedAt: startedMs === null ? null : new Date(START + startedMs).toISOString(),
        completedAt: completedMs === null ? null : new Date(START + completedMs).toISOString(),
        steps: [],
    };
}
