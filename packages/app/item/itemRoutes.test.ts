/// <reference types="bun" />
import { expect, test } from 'bun:test';
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { createMemoryHistory, createRouter } from 'vue-router';

import { stringifyGitHubQuery } from '@/app/router.options.js';
import { sampleIssue } from '@/testing/sampleItems.js';

import { formatShortReference, getItemPagePath, getOpenedItemQuery, getOpenedItemRoute } from './itemRoutes.js';

test("an item opened over a list lives in the query beside the list's own, as GitHub's project pane", () => {
    const query = getOpenedItemQuery({ filter: 'needs' }, { owner: 'acme', name: 'web', number: 12 });
    expect(query).toEqual({ filter: 'needs', pane: 'issue', issue: 'acme|web|12' });
    expect(getOpenedItemRoute(route('/issues/assigned', query))).toEqual({
        reference: { owner: 'acme', name: 'web', number: 12 },
        onPage: false,
    });

    // Another item takes its place; GitHub's `itemId` and the old `open`/`as` are not written.
    const next = getOpenedItemQuery(
        { ...query, itemId: '123', open: 'acme/web/1', as: 'modal' },
        { owner: 'acme', name: 'web', number: 3 },
    );
    expect(next).toEqual({ filter: 'needs', open: 'acme/web/1', as: 'modal', pane: 'issue', issue: 'acme|web|3' });

    // Closing it keeps the list's query.
    expect(getOpenedItemQuery(query, null)).toEqual({ filter: 'needs' });
});

test("the pane's address is GitHub's: `|` as `%7C`, read back the same", () => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/issues/assigned', component: {} }],
        stringifyQuery: stringifyGitHubQuery,
    });
    const query = getOpenedItemQuery({}, { owner: 'acme', name: 'web.js', number: 12 });
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
        getOpenedItemRoute(route('/acme/web/issues/12', {}, { owner: 'acme', name: 'web', number: '12' }, true)),
    ).toEqual({ reference: { owner: 'acme', name: 'web', number: 12 }, onPage: true });
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
    itemPage = false,
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

test('a short reference is the repository and number; an issue GitHub has not numbered yet is `#…`', () => {
    expect(formatShortReference(sampleIssue('I_1'))).toBe(`web#${sampleIssue('I_1').number}`);
    expect(formatShortReference({ ...sampleIssue('I_1'), number: 0 })).toBe('web#…');
});
