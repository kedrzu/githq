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

test('a number hit marks the digits of the reference as the menu writes it', () => {
    expect(matches(searchNavigation('#1187', DATA))).toEqual([
        { field: 'reference', text: 'api#1187', ranges: [4, 8] },
        { field: 'reference', text: 'portal#1187', ranges: [7, 11] },
    ]);
    expect(matches(searchNavigation('sigma-clinic/api#012', DATA))).toEqual([
        { field: 'reference', text: 'api#12', ranges: [4, 6] },
    ]);
});

test('`#12` is items only: a place holding the digits is not found, even with no such item', () => {
    const places = [{ ...PORTAL, id: 'sprint', title: 'Sprint 12' }];

    expect(searchNavigation('#12', { ...DATA, places }).map(result => result.kind)).toEqual(['item']);
    expect(searchNavigation('#99', { ...DATA, places })).toEqual([]);
});

test('bare digits are a number among items; a place holding them is still found', () => {
    const places = [{ ...PORTAL, id: 'sprint', title: 'Sprint 1187' }];
    const items = [...DATA.items, issue('title', 'sigma-clinic/api', 7, 'Holds 1187 in its title', '2026-10-24')];
    const results = searchNavigation('1187', { ...DATA, places, items });

    expect(ids(results)).toEqual(['b', 'a']);
    expect(results.map(result => result.kind)).toEqual(['item', 'item', 'place']);
    expect(ids(searchNavigation('12', DATA))).toEqual(['d']);
});

test('text ending in digits is not a number: `q4` searches titles', () => {
    const items = [
        issue('title', 'sigma-clinic/q', 40, 'Plan q4 budget', '2026-10-20'),
        issue('numbered', 'sigma-clinic/q', 4, 'Other', '2026-10-21'),
    ];

    expect(ids(searchNavigation('q4', { ...DATA, items }))).toEqual(['title']);
    expect(searchNavigation('q4', DATA).map(result => (result.kind === 'place' ? result.place.id : null))).toEqual([
        'project:1',
    ]);
});

test('a slash before digits names a repository, not an item in it', () => {
    expect(searchNavigation('sigma-clinic/12', DATA)).toContainEqual({
        kind: 'repository',
        score: 100,
        nameWithOwner: 'sigma-clinic/12',
    });
});

test('a title is found with a typo, in any word order and without diacritics, and marks what matched', () => {
    const data = {
        ...DATA,
        items: [
            issue('r', 'sigma-clinic/api', 1, 'Reactivity of the map', '2026-10-20'),
            issue('z', 'sigma-clinic/api', 2, 'Żółty banner', '2026-10-21'),
        ],
    };

    const [atWordStart] = searchNavigation('reactivty', data);
    expect(atWordStart).toMatchObject({ kind: 'item', score: 50 });
    expect(matches(searchNavigation('reactivty', data))).toEqual([
        { field: 'title', text: 'Reactivity of the map', ranges: [0, 10] },
    ]);
    // A typo in a word's middle still finds an item: only letters scattered do not.
    expect(searchNavigation('eactivty', data)).toMatchObject([{ kind: 'item', score: 30 }]);
    expect(ids(searchNavigation('map reactivity', data))).toEqual(['r']);
    expect(matches(searchNavigation('zolty', data))).toEqual([
        { field: 'title', text: 'Żółty banner', ranges: [0, 5] },
    ]);
});

test('an item is not found by letters scattered across its title', () => {
    expect(ids(searchNavigation('cswt', DATA))).toEqual([]);
});

test('newest first among equals, whatever the order they are kept in, and 8 items at most', () => {
    const days = ['2026-10-03', '2026-10-09', '2026-10-01', '2026-10-07', '2026-10-05'];
    const older = days.map((day, index) => issue(`old${index}`, 'a/b', index + 1, 'Same title', day));
    const newer = days.map((day, index) =>
        issue(`new${index}`, 'a/b', index + 10, 'Same title', day.replace('-10-', '-11-')),
    );

    expect(ids(searchNavigation('same title', { ...DATA, items: [...older, ...newer] }))).toEqual([
        'new1',
        'new3',
        'new4',
        'new0',
        'new2',
        'old1',
        'old3',
        'old4',
    ]);
});

test('a new array of items is searched anew: what was prepared for the last one is not reused', () => {
    const before = [issue('a', 'a/b', 1, 'Calendar', '2026-10-01')];
    const after = [...before, issue('b', 'a/b', 2, 'Calendar too', '2026-10-02')];

    expect(ids(searchNavigation('calendar', { ...DATA, items: before }))).toEqual(['a']);
    expect(ids(searchNavigation('calendar', { ...DATA, items: before }))).toEqual(['a']);
    expect(ids(searchNavigation('calendar', { ...DATA, items: after }))).toEqual(['a', 'b']);
    expect(ids(searchNavigation('too', { ...DATA, items: after }))).toEqual(['b']);
});

test("a place marks its title, a word it shows as its detail in place, and a word it doesn't show as hidden", () => {
    const owned: NavigationPlace = { ...PLATFORM, detail: 'sigma-clinic' };

    expect(matches(searchNavigation('platform', { ...DATA, places: [owned], items: [] }))).toEqual([
        { field: 'title', text: 'Platform Q4', ranges: [0, 8] },
    ]);
    expect(matches(searchNavigation('clinic', { ...DATA, places: [owned], items: [] }))).toEqual([
        { field: 'detail', text: 'sigma-clinic', ranges: [6, 12] },
    ]);
    expect(matches(searchNavigation('clinic', { ...DATA, places: [PLATFORM], items: [] }))).toEqual([
        { field: 'hidden', text: 'sigma-clinic', ranges: [6, 12] },
    ]);
});

test('a place is found by scattered letters, below the rule’s own hits', () => {
    const scattered: NavigationPlace = { ...PORTAL, id: 'scattered', title: 'Sprint planning' };
    const results = searchNavigation('spl', {
        ...DATA,
        places: [scattered, { ...PORTAL, id: 'word', title: 'Splash' }],
    });

    expect(results.map(result => (result.kind === 'place' ? result.place.id : null))).toEqual(['word', 'scattered']);
    expect(matches([results[1]].filter(result => result !== undefined))).toEqual([
        { field: 'title', text: 'Sprint planning', ranges: [0, 2, 8, 9] },
    ]);
});

test('nothing typed marks nothing and keeps the order of the places', () => {
    const results = searchNavigation('  ', DATA);

    expect(results.map(result => (result.kind === 'place' ? result.place.id : null))).toEqual([
        'project:1',
        'repository:sigma-clinic/portal',
    ]);
    expect(matches(results)).toEqual([null, null]);
});

function matches(results: readonly NavigationResult[]) {
    return results.flatMap(result => (result.kind === 'repository' ? [] : [result.match]));
}

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
