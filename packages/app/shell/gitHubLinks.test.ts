/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { createMemoryHistory, createRouter } from 'vue-router';

import routerOptions from '@/app/router.options.js';

import { getGitHubLinkTarget } from './gitHubLinks.js';

const router = createRouter({ history: createMemoryHistory(), routes: routerOptions.routes() });

function target(url: string, tracked: readonly string[] = ['acme/web']) {
    return getGitHubLinkTarget(url, { router, isTracked: name => tracked.includes(name) });
}

function path(url: string, tracked?: readonly string[]) {
    return target(url, tracked)?.path ?? null;
}

describe('githq screens', () => {
    test('an item, with its reference', () => {
        expect(target('https://github.com/acme/web/issues/12')).toEqual({
            path: '/acme/web/issues/12',
            item: { owner: 'acme', name: 'web', number: 12 },
        });
        expect(target('https://github.com/acme/web/pull/15')?.item).toEqual({ owner: 'acme', name: 'web', number: 15 });
    });

    test("an item's sub-page settles on the item (the redirect record carries the flag)", () => {
        expect(router.resolve('/acme/web/pull/1/commits').meta.gitHubScreen).toBe(true);
        expect(target('https://github.com/acme/web/pull/1/commits?w=1#x')).toEqual({
            path: '/acme/web/pull/1/commits?w=1#x',
            item: { owner: 'acme', name: 'web', number: 1 },
        });
        expect(path('https://github.com/acme/web/issues/1/anything/else')).not.toBeNull();
    });

    test('the review is a page of its own, not an item', () => {
        expect(target('https://github.com/acme/web/pull/1/files')).toEqual({
            path: '/acme/web/pull/1/files',
            item: null,
        });
        expect(target('https://github.com/acme/web/pull/1/changes')?.item).toBeNull();
        expect(path('https://github.com/acme/web/pull/1/changes')).not.toBeNull();
    });

    test('a repository and its sections, tracked or not', () => {
        for (const section of ['', '/issues', '/pulls', '/commits']) {
            expect(path(`https://github.com/other/repo${section}`)).toBe(`/other/repo${section}`);
        }
        expect(target('https://github.com/other/repo')?.item).toBeNull();
    });

    test('a list with an item opened over it is not an item page', () => {
        expect(target('https://github.com/acme/web/issues?pane=issue&issue=acme%7Cweb%7C3')?.item).toBeNull();
    });

    test('projects and their views', () => {
        expect(path('https://github.com/orgs/acme/projects/3')).toBe('/orgs/acme/projects/3');
        expect(path('https://github.com/orgs/acme/projects/3/views/2')).not.toBeNull();
        expect(path('https://github.com/users/kedrzu/projects/7')).not.toBeNull();
    });

    test('the my-work dashboards', () => {
        for (const address of ['/', '/pulls/review-requested', '/pulls', '/issues/assigned', '/pulls/mentioned']) {
            expect(path(`https://github.com${address}`), address).toBe(address);
        }
    });

    test('query and fragment are kept, www and http are taken', () => {
        expect(path('http://www.github.com/acme/web/issues?q=is%3Aopen#top')).toBe('/acme/web/issues?q=is%3Aopen#top');
        expect(path('https://www.github.com/acme/web/issues/12#issuecomment-1')).toBe(
            '/acme/web/issues/12#issuecomment-1',
        );
    });
});

describe('workflows are for a tracked repository only', () => {
    test('a run and a job', () => {
        const run = 'https://github.com/acme/web/actions/runs/123';
        expect(path(run)).toBe('/acme/web/actions/runs/123');
        expect(path(`${run}/job/4`)).toBe('/acme/web/actions/runs/123/job/4');
        expect(path('https://github.com/other/repo/actions/runs/123')).toBeNull();
        expect(path('https://github.com/other/repo/actions/runs/123/job/4')).toBeNull();
    });

    test("a repository's actions", () => {
        expect(path('https://github.com/acme/web/actions')).toBe('/acme/web/actions');
        expect(path('https://github.com/other/repo/actions')).toBeNull();
    });
});

describe('GitHub keeps', () => {
    test.each([
        'https://github.com/kedrzu',
        'https://github.com/acme/web/commit/0123abc',
        'https://github.com/acme/web/blob/main/x',
        'https://github.com/acme/web/compare/a...b',
        'https://github.com/acme/web/actions/runs/123/attempts/2',
        'https://github.com/acme/web/actions/workflows/ci.yml',
        'https://github.com/orgs/acme',
        'https://github.com/notifications',
    ])('%s', url => {
        expect(target(url)).toBeNull();
    });

    test("settings of a repository or a project, and githq's own pages", () => {
        for (const url of [
            'https://github.com/acme/web/settings',
            'https://github.com/orgs/acme/projects/1/settings',
            'https://github.com/users/kedrzu/projects/1/settings',
            'https://github.com/settings',
            'https://github.com/settings/tracking/new',
            'https://github.com/login',
            'https://github.com/auth/callback',
            'https://github.com/download',
            'https://github.com/dashboard/workflows',
        ]) {
            expect(target(url), url).toBeNull();
        }
    });
});

describe('only github.com is githq', () => {
    test.each([
        'https://example.com/acme/web/issues/1',
        'https://gist.github.com/acme/web/issues/1',
        'https://github.com.evil.com/acme/web/issues/1',
        'https://evilgithub.com/acme/web/issues/1',
        'https://github.com@evil.com/acme/web/issues/1',
        'https://user@github.com/acme/web/issues/1',
        'https://user:pass@github.com/acme/web/issues/1',
        'https://github.com:8443/acme/web/issues/1',
        'ftp://github.com/acme/web/issues/1',
        'javascript:alert(1)',
        'data:text/html,github.com',
        '//evil.com/acme/web/issues/1',
        '//github.com/acme/web/issues/1',
        'https://github.com//evil.com/acme/web',
        '/acme/web/issues/1',
        'github.com/acme/web/issues/1',
        '',
        'not a url',
    ])('%p', url => {
        expect(target(url)).toBeNull();
    });
});
