/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { createMemoryHistory, createRouter } from 'vue-router';

import routerOptions from '@/app/router.options.js';
import type { OpenedItemKind } from '@/item/defineOpenedItemKind.js';
import type { ItemList } from '@/item/ItemNavigation.js';
import type { RepositorySection } from '@/repository/RepositorySection.js';

import type { GetOpenPlaceParams, OpenPlace, OpenPlaceItem, OpenPlaceProject } from './getOpenPlace.js';
import { getOpenPlace } from './getOpenPlace.js';

const router = createRouter({ history: createMemoryHistory(), routes: routerOptions.routes() });

const PROJECT: OpenPlaceProject = {
    id: 'PVT_q4',
    views: [
        { id: 'PVTV_sprint', number: 1 },
        { id: 'PVTV_board', number: 2 },
    ],
};
/** Issue 12 of acme/web is in the local copy; 15 is a pull request; 99 is not there yet. */
const ITEMS: Readonly<Record<number, OpenPlaceItem>> = {
    12: { id: 'I_12', kind: 'issue' },
    15: { id: 'PR_15', kind: 'pullRequest' },
};

test("a repository's section is the address's, at its own address the one it was left on", () => {
    expect(place('/acme/web/pulls')).toEqual(repository('pullRequests'));
    expect(place('/acme/web/actions')).toEqual(repository('workflows'));
    expect(place('/acme/web', { lastSection: 'commits' })).toEqual(repository('commits'));
    // An item over the list in the panel is a query on the list's address.
    expect(place('/acme/web/issues?pane=issue&issue=acme%7Cweb%7C12')).toEqual(repository('issues'));
});

test("a project's view is the address's, else its first; All items its own key; a project not tracked none", () => {
    expect(place('/orgs/acme/projects/3/views/2')).toEqual(project('PVTV_board'));
    expect(place('/orgs/acme/projects/3')).toEqual(project('PVTV_sprint'));
    expect(place('/orgs/acme/projects/3/views/9')).toEqual(project('PVTV_sprint'));
    expect(place('/orgs/acme/projects/3/views/2?all')).toEqual(project('all'));
    expect(place('/orgs/acme/projects/3?pane=issue&issue=acme%7Cweb%7C12')).toEqual(project('PVTV_sprint'));
    expect(place('/users/kedrzu/projects/7')).toBeNull();
    expect(
        getOpenPlace({ ...params('/orgs/acme/projects/3'), findProject: () => ({ id: 'PVT_q4', views: [] }) }),
    ).toEqual({ kind: 'project', id: 'PVT_q4', viewKey: null });
});

test('outside a repository or a project there is no place', () => {
    expect(place('/')).toBeNull();
    expect(place('/settings')).toBeNull();
    expect(place('/acme/web/settings')).toBeNull();
});

test('an item full screen is in the list it was opened from while that list steps through it', () => {
    const projectList = list('issue', '/orgs/acme/projects/3/views/2?pane=issue&issue=acme%7Cweb%7C12', ['I_12']);
    expect(place('/acme/web/issues/12', { list: projectList })).toEqual(project('PVTV_board'));
    // A pull request of a collapsed stack steps through its entry's step.
    const stacked = { ...list('issue', '/acme/web/issues', ['I_12']), stepOf: new Map([['PR_15', 'I_12']]) };
    expect(place('/acme/web/pull/15', { list: stacked })).toEqual(repository('issues'));
    // Opened from My work, the item is in no repository's or project's place.
    expect(place('/acme/web/issues/12', { list: list('issue', '/issues/assigned', ['I_12']) })).toBeNull();
});

test('an item full screen not in the list shown last is in its own repository, in the section of its kind', () => {
    const elsewhere = list('issue', '/orgs/acme/projects/3/views/2', ['I_1']);
    expect(place('/acme/web/issues/12', { list: elsewhere })).toEqual(repository('issues'));
    // Found by its number, a pull request at an issue's address is still a pull request.
    expect(place('/acme/web/issues/15')).toEqual(repository('pullRequests'));
    // Not in the local copy yet, the address says.
    expect(place('/acme/web/issues/99', { list: elsewhere })).toEqual(repository('issues'));
    expect(place('/acme/web/pull/99')).toEqual(repository('pullRequests'));
    expect(place('/acme/web/pull/15/files')).toEqual(repository('pullRequests'));
    // A list of another kind never holds it, whatever its steps say.
    expect(place('/acme/web/issues/12', { list: list('workflow', '/orgs/acme/projects/3', ['I_12']) })).toEqual(
        repository('issues'),
    );
});

test('a workflow, its run and a commit full screen are in their list, else their own section', () => {
    // Opened from the broken workflows of every repository, it is in no repository's place.
    const broken = list('workflow', '/dashboard/workflows', ['acme/web/deploy.yml']);
    expect(place('/acme/web/actions/workflows/deploy.yml', { list: broken })).toBeNull();
    expect(place('/acme/web/actions/workflows/ci.yml', { list: broken })).toEqual(repository('workflows'));
    // A run is never a list's step.
    expect(place('/acme/web/actions/runs/42', { list: broken })).toEqual(repository('workflows'));
    expect(place('/acme/web/commit/abc1234')).toEqual(repository('commits'));
});

interface PlaceOptions {
    readonly list?: ItemList;
    readonly lastSection?: RepositorySection;
}

function place(path: string, options: PlaceOptions = {}) {
    return getOpenPlace(params(path, options));
}

function params(path: string, options: PlaceOptions = {}): GetOpenPlaceParams {
    return {
        route: router.resolve(path),
        list: options.list ?? null,
        resolve: to => router.resolve(to),
        getShownSection: (_nameWithOwner, address) => address ?? options.lastSection ?? 'issues',
        findProject: address => (address.owner === 'acme' && address.number === 3 ? PROJECT : null),
        findItem: reference =>
            reference.owner === 'acme' && reference.name === 'web' ? (ITEMS[reference.number] ?? null) : null,
    };
}

function list(kind: OpenedItemKind, path: string, steps: readonly string[]): ItemList {
    return { kind, path, title: 'List', steps, stepOf: new Map(), around: null };
}

function repository(section: RepositorySection): OpenPlace {
    return { kind: 'repository', nameWithOwner: 'acme/web', section };
}

function project(viewKey: string): OpenPlace {
    return { kind: 'project', id: 'PVT_q4', viewKey };
}
