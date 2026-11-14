/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { createMemoryHistory, createRouter } from 'vue-router';

import routerOptions from '@/app/router.options.js';
import { getOpenedItemRoute } from '@/item/itemRoutes.js';
import { isTrackedOnlyRoute } from '@/tracking/trackingRoutes.js';

import { WorkflowRoutes } from './workflowRoutes.js';

const router = createRouter({
    history: createMemoryHistory(),
    routes: routerOptions.routes(),
    stringifyQuery: routerOptions.stringifyQuery,
});

test("a workflow in the panel is GitHub's pane format on the repository's Workflows section, read back the same", () => {
    const reference = { owner: 'acme', name: 'web.js', file: 'deploy.yml' };
    const { fullPath } = router.resolve({
        path: '/acme/web.js/actions',
        query: WorkflowRoutes.getQuery({}, reference),
    });
    expect(fullPath).toBe('/acme/web.js/actions?pane=workflow&workflow=acme%7Cweb.js%7Cdeploy.yml');
    for (const address of [fullPath, '/acme/web.js/actions?pane=workflow&workflow=acme|web.js|deploy.yml']) {
        expect(getOpenedItemRoute(router.resolve(address))).toEqual({ kind: 'workflow', reference, onPage: false });
    }
});

test("a workflow's page is GitHub's address of it, its file or a generated workflow's segment; tracked only", () => {
    for (const file of ['deploy.yml', 'pages']) {
        const reference = { owner: 'acme', name: 'web', file };
        const resolved = router.resolve(WorkflowRoutes.getPagePath(reference));
        expect(resolved.fullPath).toBe(`/acme/web/actions/workflows/${file}`);
        expect(getOpenedItemRoute(resolved)).toEqual({ kind: 'workflow', reference, onPage: true });
        expect(resolved.meta.gitHubScreen).toBe(true);
        // An untracked repository's is GitHub's page (`middleware/auth.global.ts`).
        expect(isTrackedOnlyRoute(resolved)).toBe(true);
    }
});

test('a malformed workflow pane opens nothing', () => {
    for (const workflow of ['acme|web', 'acme|web|', 'acme||deploy.yml', '|web|deploy.yml', 'acme/web/deploy.yml']) {
        expect(
            getOpenedItemRoute(router.resolve({ path: '/acme/web/actions', query: { pane: 'workflow', workflow } })),
        ).toBeNull();
    }

    expect(getOpenedItemRoute(router.resolve('/acme/web/actions?workflow=acme|web|deploy.yml'))).toBeNull();
    expect(getOpenedItemRoute(router.resolve('/acme/web/actions?pane=issue&workflow=acme|web|deploy.yml'))).toBeNull();
});
