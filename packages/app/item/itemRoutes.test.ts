/// <reference types="bun" />
import { expect, test } from 'bun:test';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

import { sampleIssue } from '@/testing/sampleItems.js';

import {
    formatShortReference,
    getItemPagePath,
    getOpenedItemQuery,
    getOpenedItemRoute,
    parseItemReference,
} from './itemRoutes.js';

test("an item opened over a list lives in the query beside the list's own, in a panel unless it says modal", () => {
    const query = getOpenedItemQuery({ filter: 'needs' }, { owner: 'acme', name: 'web', number: 12 }, 'modal');
    expect(query).toEqual({ filter: 'needs', open: 'acme/web/12', as: 'modal' });
    expect(getOpenedItemRoute(route('/my/assigned', query))).toEqual({
        reference: { owner: 'acme', name: 'web', number: 12 },
        arrangement: 'modal',
    });

    const panel = getOpenedItemQuery(query, { owner: 'acme', name: 'web', number: 3 });
    expect(panel).toEqual({ filter: 'needs', open: 'acme/web/3' });
    expect(getOpenedItemRoute(route('/', panel))?.arrangement).toBe('panel');

    // Closing it keeps the list's query.
    expect(getOpenedItemQuery(query, null)).toEqual({ filter: 'needs' });
});

test("an item's page is GitHub's address of it", () => {
    expect(getItemPagePath({ owner: 'acme', name: 'web', number: 15 }, 'pullRequest')).toBe('/acme/web/pull/15');
    expect(
        getOpenedItemRoute(route('/acme/web/issues/12', {}, { owner: 'acme', name: 'web', number: '12' }, true)),
    ).toEqual({ reference: { owner: 'acme', name: 'web', number: 12 }, arrangement: 'page' });
});

test('a malformed reference opens nothing', () => {
    for (const value of ['acme/web', 'acme/web/0', 'acme/web/12/x', 'acme//12', 'acme/web/1e3']) {
        expect(parseItemReference(value)).toBeNull();
    }

    expect(getOpenedItemRoute(route('/', { open: ['a/b/1', 'c/d/2'] }))).toBeNull();
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
