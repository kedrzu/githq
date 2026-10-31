import { expect, test } from 'bun:test';

import type { IssueItem } from '@/store/ItemTypes.js';
import { sampleIssue } from '@/testing/sampleItems.js';

import { searchNavigation } from './searchNavigation.js';
import type { NavigationData, NavigationPlace, NavigationResult } from './searchNavigation.js';

const PLATFORM: NavigationPlace = {
    id: 'project:1',
    group: 'projects',
    kind: 'project',
    title: 'Platform Q4',
    keywords: ['sigma-clinic'],
    path: '/orgs/sigma-clinic/projects/4',
};
const PORTAL: NavigationPlace = {
    id: 'repository:sigma-clinic/portal',
    group: 'repositories',
    kind: 'repository',
    title: 'sigma-clinic/portal',
    path: '/sigma-clinic/portal',
};

const DATA: NavigationData = {
    places: [PLATFORM, PORTAL],
    trackedRepositories: ['sigma-clinic/portal'],
    items: [
        issue('a', 'sigma-clinic/portal', 1187, 'Calendar shows wrong timezone', '2026-10-20'),
        issue('b', 'sigma-clinic/api', 1187, 'Timezone of the API', '2026-10-21'),
        issue('c', 'sigma-clinic/api', 490, 'Platform fee rounding on invoices', '2026-10-22'),
        issue('d', 'sigma-clinic/api', 12, 'Rounding of the platform fee', '2026-10-23'),
    ],
};

test('a number finds the items with it; a repository before it narrows them to that repository', () => {
    expect(ids(searchNavigation('#1187', DATA))).toEqual(['b', 'a']);
    expect(ids(searchNavigation('portal#1187', DATA))).toEqual(['a']);
    expect(ids(searchNavigation('sigma-clinic/api#1187', DATA))).toEqual(['b']);
});

test('a title starting with the text ranks above a title holding its words; places are found by name or owner', () => {
    const results = searchNavigation('platform fee', DATA);

    expect(ids(results)).toEqual(['c', 'd']);
    expect(results.map(result => result.score)).toEqual([80, 60]);
    expect(searchNavigation('sigma', DATA).map(result => (result.kind === 'place' ? result.place.id : null))).toEqual([
        'project:1',
        'repository:sigma-clinic/portal',
    ]);
});

test('owner/name of a repository not tracked is offered to open (J3); a tracked one is its place', () => {
    expect(searchNavigation('sigma-clinic/platform-infra', DATA)).toContainEqual({
        kind: 'repository',
        score: 100,
        nameWithOwner: 'sigma-clinic/platform-infra',
    });
    expect(searchNavigation('https://github.com/sigma-clinic/platform-infra/issues', DATA)).toContainEqual({
        kind: 'repository',
        score: 100,
        nameWithOwner: 'sigma-clinic/platform-infra',
    });
    expect(searchNavigation('sigma-clinic/portal', DATA).filter(result => result.kind === 'repository')).toEqual([]);
    expect(searchNavigation('sigma-clinic/api#1187', DATA).filter(result => result.kind === 'repository')).toEqual([]);
});

test('an issue being created is not found: it has no number to open it by yet', () => {
    const data = {
        ...DATA,
        items: [...DATA.items, issue('pending', 'sigma-clinic/api', 0, 'Platform fee draft', '2026-10-24')],
    };

    expect(ids(searchNavigation('platform fee', data))).toEqual(['c', 'd']);
    expect(ids(searchNavigation('#0', data))).toEqual([]);
});

test('nothing typed lists every place and no item', () => {
    expect(searchNavigation('', DATA).map(result => result.kind)).toEqual(['place', 'place']);
});

function ids(results: readonly NavigationResult[]) {
    return results.flatMap(result => (result.kind === 'item' ? [result.item.id] : []));
}

function issue(id: string, nameWithOwner: string, number: number, title: string, day: string): IssueItem {
    const base = sampleIssue(id);
    return {
        ...base,
        number,
        title,
        updatedAt: `${day}T10:00:00Z`,
        repository: { ...base.repository, nameWithOwner },
    };
}
