/// <reference types="bun" />
import { expect, test } from 'bun:test';
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { createMemoryHistory, createRouter } from 'vue-router';

import { stringifyGitHubQuery } from '@/app/router.options.js';
import { sampleIssue } from '@/testing/sampleItems.js';

import { WorkflowRoutes } from '@/workflows/workflowRoutes.js';

import type { OpenedItemKind } from './defineOpenedItemKind.js';
import {
    formatShortReference,
    getItemPagePath,
    getOpenedItemRoute,
    getReviewCommentPath,
    IssueRoutes,
    parseItemUrl,
} from './itemRoutes.js';

test("an item opened over a list lives in the query beside the list's own, as GitHub's project pane", () => {
    const query = IssueRoutes.getQuery({ filter: 'needs' }, { owner: 'acme', name: 'web', number: 12 });
    expect(query).toEqual({ filter: 'needs', pane: 'issue', issue: 'acme|web|12' });
    expect(getOpenedItemRoute(route('/issues/assigned', query))).toEqual({
        kind: 'issue',
        reference: { owner: 'acme', name: 'web', number: 12 },
        onPage: false,
    });

    // Another item takes its place; GitHub's `itemId` and the old `open`/`as` are not written.
    const next = IssueRoutes.getQuery(
        { ...query, itemId: '123', open: 'acme/web/1', as: 'page' },
        { owner: 'acme', name: 'web', number: 3 },
    );
    expect(next).toEqual({ filter: 'needs', open: 'acme/web/1', as: 'page', pane: 'issue', issue: 'acme|web|3' });

    // Closing it keeps the list's query.
    expect(IssueRoutes.getQuery(query, null)).toEqual({ filter: 'needs' });
});

test("the pane's address is GitHub's: `|` as `%7C`, read back the same", () => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/issues/assigned', component: {} }],
        stringifyQuery: stringifyGitHubQuery,
    });
    const query = IssueRoutes.getQuery({}, { owner: 'acme', name: 'web.js', number: 12 });
    const { fullPath } = router.resolve({ path: '/issues/assigned', query });
    expect(fullPath).toBe('/issues/assigned?pane=issue&issue=acme%7Cweb.js%7C12');
    for (const address of [fullPath, '/issues/assigned?pane=issue&issue=acme|web.js|12']) {
        expect(getOpenedItemRoute(router.resolve(address))?.reference).toEqual({
            owner: 'acme',
            name: 'web.js',
            number: 12,
        });
    }
});

test("an item's page is GitHub's address of it", () => {
    expect(getItemPagePath({ owner: 'acme', name: 'web', number: 15 }, 'pullRequest')).toBe('/acme/web/pull/15');
    expect(getItemPagePath({ owner: 'acme', name: 'web', number: 15 })).toBe('/acme/web/issues/15');
    expect(
        getOpenedItemRoute(route('/acme/web/issues/12', {}, { owner: 'acme', name: 'web', number: '12' }, 'issue')),
    ).toEqual({ kind: 'issue', reference: { owner: 'acme', name: 'web', number: 12 }, onPage: true });
});

test("a github.com address names its item, in the address's repository", () => {
    expect(parseItemUrl('https://github.com/upstream/web.js/pull/15')).toEqual({
        owner: 'upstream',
        name: 'web.js',
        number: 15,
    });
    expect(parseItemUrl('https://github.com/acme/web/issues/12')).toEqual({ owner: 'acme', name: 'web', number: 12 });
    for (const url of [
        'https://github.com/acme/web',
        'https://github.com/acme/web/commit/12',
        'https://github.com/acme/web/pull/0',
        'https://example.com/acme/web/pull/12',
    ]) {
        expect(parseItemUrl(url)).toBeNull();
    }
});

test("a comment on the code is addressed in its pull request's review, by GitHub's anchor", () => {
    expect(getReviewCommentPath('https://github.com/acme/web/pull/15#discussion_r7')).toBe(
        '/acme/web/pull/15/files#discussion_r7',
    );
    for (const url of [
        'https://github.com/acme/web/pull/15',
        'https://github.com/acme/web/pull/15#issuecomment-7',
        'https://example.com/acme/web/pull/15#discussion_r7',
    ]) {
        expect(getReviewCommentPath(url)).toBeNull();
    }
});

test('a malformed pane opens nothing', () => {
    for (const issue of ['acme|web', 'acme|web|0', 'acme|web|12|x', 'acme||12', 'acme|web|1e3', 'acme/web/12']) {
        expect(getOpenedItemRoute(route('/', { pane: 'issue', issue }))).toBeNull();
    }

    expect(getOpenedItemRoute(route('/', { pane: 'issue', issue: ['a|b|1', 'c|d|2'] }))).toBeNull();
    // Without `pane=issue`, or only GitHub's project item id, or the old format: nothing is opened.
    expect(getOpenedItemRoute(route('/', { issue: 'acme|web|12' }))).toBeNull();
    expect(getOpenedItemRoute(route('/', { pane: 'pr', issue: 'acme|web|12' }))).toBeNull();
    expect(getOpenedItemRoute(route('/', { pane: 'issue', itemId: '123' }))).toBeNull();
    expect(getOpenedItemRoute(route('/', { open: 'acme/web/12' }))).toBeNull();
});

function route(
    path: string,
    query: RouteLocationNormalizedLoaded['query'],
    params: RouteLocationNormalizedLoaded['params'] = {},
    itemPage?: OpenedItemKind,
): RouteLocationNormalizedLoaded {
    return {
        path,
        query,
        params,
        meta: itemPage ? { itemPage } : {},
        fullPath: path,
        hash: '',
        name: undefined,
        matched: [],
        redirectedFrom: undefined,
    };
}

test('an item of one kind opened over a list takes the place of one of the other kind', () => {
    const workflow = { owner: 'acme', name: 'web', file: 'deploy.yml' };
    const withWorkflow = WorkflowRoutes.getQuery({ filter: 'needs' }, workflow);
    expect(withWorkflow).toEqual({ filter: 'needs', pane: 'workflow', workflow: 'acme|web|deploy.yml' });
    expect(getOpenedItemRoute(route('/acme/web/actions', withWorkflow))).toEqual({
        kind: 'workflow',
        reference: workflow,
        onPage: false,
    });
    expect(IssueRoutes.getOpened(route('/acme/web/actions', withWorkflow))).toBeNull();

    const withIssue = IssueRoutes.getQuery(withWorkflow, { owner: 'acme', name: 'web', number: 3 });
    expect(withIssue).toEqual({ filter: 'needs', pane: 'issue', issue: 'acme|web|3' });
    expect(WorkflowRoutes.getOpened(route('/acme/web/actions', withIssue))).toBeNull();
    expect(WorkflowRoutes.getQuery(withIssue, null)).toEqual({ filter: 'needs' });
});

test("a page opens only its own kind's item, whatever the query says", () => {
    const params = { owner: 'acme', name: 'web', file: 'deploy.yml' };
    expect(getOpenedItemRoute(route('/acme/web/actions/workflows/deploy.yml', {}, params, 'workflow'))).toEqual({
        kind: 'workflow',
        reference: params,
        onPage: true,
    });
    const issuePage = route(
        '/acme/web/issues/12',
        { pane: 'workflow', workflow: 'acme|web|deploy.yml' },
        { owner: 'acme', name: 'web', number: '12' },
        'issue',
    );
    expect(getOpenedItemRoute(issuePage)?.kind).toBe('issue');
    expect(WorkflowRoutes.getOpened(issuePage)).toBeNull();
});

test('a page expanded from the panel is marked with its kind, and Back to the panel reads only its own', () => {
    const reference = { owner: 'acme', name: 'web', number: 15 };
    const location = IssueRoutes.getExpandedLocation({ reference, path: getItemPagePath(reference, 'pullRequest') });
    expect(location).toEqual({
        path: '/acme/web/pull/15',
        state: { expandedFrom: { kind: 'issue', key: 'acme/web/15' } },
    });
    const state = typeof location === 'object' && 'state' in location ? (location.state ?? {}) : {};
    expect(IssueRoutes.getExpandedFrom(state)).toBe('acme/web/15');
    expect(WorkflowRoutes.getExpandedFrom(state)).toBeNull();

    const workflow = WorkflowRoutes.getExpandedLocation({ reference: { owner: 'acme', name: 'web', file: 'ci.yml' } });
    expect(workflow).toEqual({
        path: '/acme/web/actions/workflows/ci.yml',
        state: { expandedFrom: { kind: 'workflow', key: 'acme/web/ci.yml' } },
    });

    // A page opened any other way, or marked by an older build, carries no mark.
    for (const unmarked of [{}, { expandedFrom: 'acme/web/15' }, { expandedFrom: null }, { expandedFrom: ['issue'] }]) {
        expect(IssueRoutes.getExpandedFrom(unmarked)).toBeNull();
    }
});

test('a short reference is the repository and number; an issue GitHub has not numbered yet is `#…`', () => {
    expect(formatShortReference(sampleIssue('I_1'))).toBe(`web#${sampleIssue('I_1').number}`);
    expect(formatShortReference({ ...sampleIssue('I_1'), number: 0 })).toBe('web#…');
});
