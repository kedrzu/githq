/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { createMemoryHistory, createRouter } from 'vue-router';

import routerOptions from '@/app/router.options.js';
import { getOpenedItemRoute, IssueRoutes } from '@/item/itemRoutes.js';
import { isRouteShownOnPhone, isTrackedOnlyRoute } from '@/tracking/trackingRoutes.js';
import { WorkflowRoutes } from '@/workflows/workflowRoutes.js';

import { CommitRoutes, parseCommitKey } from './commitRoutes.js';

const router = createRouter({
    history: createMemoryHistory(),
    routes: routerOptions.routes(),
    stringifyQuery: routerOptions.stringifyQuery,
});

const OID = '0123456789abcdef0123456789abcdef01234567';

test("a commit in the panel is GitHub's pane format on the repository's Commits section, read back the same", () => {
    const reference = { owner: 'acme', name: 'web.js', oid: OID };
    const { fullPath } = router.resolve({
        path: '/acme/web.js/commits',
        query: CommitRoutes.getQuery({}, reference),
    });
    expect(fullPath).toBe(`/acme/web.js/commits?pane=commit&commit=acme%7Cweb.js%7C${OID}`);
    for (const address of [fullPath, `/acme/web.js/commits?pane=commit&commit=acme|web.js|${OID}`]) {
        expect(getOpenedItemRoute(router.resolve(address))).toEqual({ kind: 'commit', reference, onPage: false });
    }
});

test("a commit's page is GitHub's address of it, by a short or full sha, in any repository; the phone hands it off", () => {
    for (const oid of [OID, '0123abc', '0123ABC']) {
        const reference = { owner: 'acme', name: 'web', oid };
        const resolved = router.resolve(CommitRoutes.getPagePath(reference));
        expect(resolved.name).toBe('commit-page');
        expect(resolved.fullPath).toBe(`/acme/web/commit/${oid}`);
        expect(getOpenedItemRoute(resolved)).toEqual({ kind: 'commit', reference, onPage: true });
        expect(resolved.meta.gitHubScreen).toBe(true);
        // Not handed off for an untracked repository (`middleware/auth.global.ts`), as the Commits section isn't.
        expect(isTrackedOnlyRoute(resolved)).toBe(false);
        expect(isRouteShownOnPhone(resolved)).toBe(false);
    }

    // Not a sha, or GitHub's other pages of a commit: GitHub's page.
    for (const address of [
        '/acme/web/commit/0123ab',
        '/acme/web/commit/main',
        `/acme/web/commit/${OID}0`,
        `/acme/web/commit/${OID}.patch`,
    ]) {
        expect(router.resolve(address).name, address).toBe('github');
    }
});

test('a malformed commit pane opens nothing', () => {
    for (const commit of [
        'acme|web',
        'acme|web|',
        `acme||${OID}`,
        `|web|${OID}`,
        'acme|web|main',
        'acme|web|0123ab',
        `acme|web|${OID}|x`,
        `acme/web/${OID}`,
    ]) {
        expect(
            getOpenedItemRoute(router.resolve({ path: '/acme/web/commits', query: { pane: 'commit', commit } })),
            commit,
        ).toBeNull();
    }

    expect(getOpenedItemRoute(router.resolve(`/acme/web/commits?commit=acme|web|${OID}`))).toBeNull();
});

test("opening a commit drops another kind's item, and opening another kind drops the commit", () => {
    const commit = { owner: 'acme', name: 'web', oid: OID };
    const withIssue = IssueRoutes.getQuery({ q: 'x' }, { owner: 'acme', name: 'web', number: 3 });
    const withCommit = CommitRoutes.getQuery(withIssue, commit);
    expect(withCommit).toEqual({ q: 'x', pane: 'commit', commit: `acme|web|${OID}` });

    const withWorkflow = WorkflowRoutes.getQuery(withCommit, { owner: 'acme', name: 'web', file: 'ci.yml' });
    expect(withWorkflow).toEqual({ q: 'x', pane: 'workflow', workflow: 'acme|web|ci.yml' });
    expect(CommitRoutes.getQuery(withCommit, null)).toEqual({ q: 'x' });
});

test('a list of commits steps through their keys, each read back as the commit it names', () => {
    const reference = { owner: 'acme', name: 'web.js', oid: OID };
    expect(parseCommitKey(CommitRoutes.formatKey(reference))).toEqual(reference);
    expect(parseCommitKey('acme/web')).toBeNull();
    expect(parseCommitKey('acme/web/main')).toBeNull();
    expect(parseCommitKey(`acme/web/${OID}/x`)).toBeNull();
});
