/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { createMemoryHistory, createRouter } from 'vue-router';

import routerOptions from '@/app/router.options.js';
import { CommitRoutes } from '@/commits/commitRoutes.js';
import { getOpenedItemRoute, IssueRoutes } from '@/item/itemRoutes.js';

import { WorkflowRunRoutes } from './workflowRunRoutes.js';

const router = createRouter({
    history: createMemoryHistory(),
    routes: routerOptions.routes(),
    stringifyQuery: routerOptions.stringifyQuery,
});

test("a run in the panel is GitHub's pane format on the repository's Workflows section, with or without its job", () => {
    for (const [reference, value] of [
        [{ owner: 'acme', name: 'web.js', runId: 123, jobId: null }, 'acme%7Cweb.js%7C123'],
        [{ owner: 'acme', name: 'web.js', runId: 123, jobId: 456 }, 'acme%7Cweb.js%7C123%7C456'],
    ] as const) {
        const { fullPath } = router.resolve({
            path: '/acme/web.js/actions',
            query: WorkflowRunRoutes.getQuery({}, reference),
        });
        expect(fullPath).toBe(`/acme/web.js/actions?pane=run&run=${value}`);
        for (const address of [fullPath, `/acme/web.js/actions?pane=run&run=${decodeURIComponent(value)}`]) {
            expect(getOpenedItemRoute(router.resolve(address))).toEqual({ kind: 'run', reference, onPage: false });
        }
    }
});

test("a run's page is GitHub's address of the run or of its job, one page with its own key per run", () => {
    for (const [reference, path, name] of [
        [{ owner: 'acme', name: 'web', runId: 123, jobId: null }, '/acme/web/actions/runs/123', 'workflow-run'],
        [
            { owner: 'acme', name: 'web', runId: 123, jobId: 456 },
            '/acme/web/actions/runs/123/job/456',
            'workflow-run-job',
        ],
    ] as const) {
        expect(WorkflowRunRoutes.getPagePath(reference)).toBe(path);
        const resolved = router.resolve(path);
        expect(resolved.name).toBe(name);
        expect(getOpenedItemRoute(resolved)).toEqual({ kind: 'run', reference, onPage: true });
        // Still `WorkflowRunPage`, one instance per run whichever job: the route's own key, not an item page's.
        expect(typeof resolved.meta.key).toBe('function');
    }
});

test('the key of a run leaves its job out: moving between the jobs is the same run', () => {
    const run = { owner: 'acme', name: 'web', runId: 123, jobId: null };
    expect(WorkflowRunRoutes.formatKey(run)).toBe('acme/web/123');
    expect(WorkflowRunRoutes.formatKey({ ...run, jobId: 456 })).toBe('acme/web/123');
});

test('a malformed run pane opens nothing', () => {
    for (const run of [
        'acme|web',
        'acme|web|',
        'acme||123',
        '|web|123',
        'acme|web|abc',
        'acme|web|0',
        'acme|web|-1',
        'acme|web|1.5',
        'acme|web|123|',
        'acme|web|123|abc',
        'acme|web|123|0',
        'acme|web|123|456|7',
        'acme/web/123',
    ]) {
        expect(
            getOpenedItemRoute(router.resolve({ path: '/acme/web/actions', query: { pane: 'run', run } })),
            run,
        ).toBeNull();
    }

    expect(getOpenedItemRoute(router.resolve('/acme/web/actions?run=acme|web|123'))).toBeNull();
});

test("opening a run drops another kind's item, and opening another kind drops the run", () => {
    const run = { owner: 'acme', name: 'web', runId: 123, jobId: 456 };
    const withIssue = IssueRoutes.getQuery({ q: 'x' }, { owner: 'acme', name: 'web', number: 3 });
    const withRun = WorkflowRunRoutes.getQuery(withIssue, run);
    expect(withRun).toEqual({ q: 'x', pane: 'run', run: 'acme|web|123|456' });

    const withCommit = CommitRoutes.getQuery(withRun, { owner: 'acme', name: 'web', oid: '0123abc' });
    expect(withCommit).toEqual({ q: 'x', pane: 'commit', commit: 'acme|web|0123abc' });
    expect(WorkflowRunRoutes.getQuery(withRun, null)).toEqual({ q: 'x' });
});
