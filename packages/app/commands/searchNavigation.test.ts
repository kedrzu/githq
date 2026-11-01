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
    keywords: ['skyline-labs'],
    path: '/orgs/skyline-labs/projects/4',
};
const PORTAL: NavigationPlace = {
    id: 'repository:skyline-labs/portal',
    group: 'repositories',
    kind: 'repository',
    title: 'skyline-labs/portal',
    path: '/skyline-labs/portal',
};

const DATA: NavigationData = {
    places: [PLATFORM, PORTAL],
    trackedRepositories: ['skyline-labs/portal'],
    items: [
        issue('a', 'skyline-labs/portal', 1187, 'Calendar shows wrong timezone', '2026-10-20'),
        issue('b', 'skyline-labs/api', 1187, 'Timezone of the API', '2026-10-21'),
        issue('c', 'skyline-labs/api', 490, 'Platform fee rounding on invoices', '2026-10-22'),
        issue('d', 'skyline-labs/api', 12, 'Rounding of the platform fee', '2026-10-23'),
    ],
};

test('a number finds the items with it; a repository before it narrows them to that repository', () => {
    expect(ids(searchNavigation('#1187', DATA))).toEqual(['b', 'a']);
    expect(ids(searchNavigation('portal#1187', DATA))).toEqual(['a']);
    expect(ids(searchNavigation('skyline-labs/api#1187', DATA))).toEqual(['b']);
});

test('a title starting with the text ranks above a title holding its words; places are found by name or owner', () => {
    const results = searchNavigation('platform fee', DATA);

    expect(ids(results)).toEqual(['c', 'd']);
    expect(results.map(result => result.score)).toEqual([80, 60]);
    expect(searchNavigation('skyline', DATA).map(result => (result.kind === 'place' ? result.place.id : null))).toEqual(
        ['project:1', 'repository:skyline-labs/portal'],
    );
});

test('owner/name of a repository not tracked is offered to open (J3); a tracked one is its place', () => {
    expect(searchNavigation('skyline-labs/platform-infra', DATA)).toContainEqual({
        kind: 'repository',
        score: 100,
        nameWithOwner: 'skyline-labs/platform-infra',
    });
    expect(searchNavigation('https://github.com/skyline-labs/platform-infra/issues', DATA)).toContainEqual({
        kind: 'repository',
        score: 100,
        nameWithOwner: 'skyline-labs/platform-infra',
    });
    expect(searchNavigation('skyline-labs/portal', DATA).filter(result => result.kind === 'repository')).toEqual([]);
    expect(searchNavigation('skyline-labs/api#1187', DATA).filter(result => result.kind === 'repository')).toEqual([]);
});

test('an issue being created is not found: it has no number to open it by yet', () => {
    const data = {
        ...DATA,
        items: [...DATA.items, issue('pending', 'skyline-labs/api', 0, 'Platform fee draft', '2026-10-24')],
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
