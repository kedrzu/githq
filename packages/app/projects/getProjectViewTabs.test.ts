/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { SAMPLE_PROJECT, SAMPLE_TODAY, SAMPLE_VIEW_BOARD, SAMPLE_VIEW_SPRINT } from '@/testing/sampleProject.js';

import type { GetProjectViewTabsParams } from './getProjectViewTabs.js';
import { getProjectViewTabs } from './getProjectViewTabs.js';
import type { Project } from './ProjectTypes.js';
import type { ProjectTab } from './ProjectView.vue';
import { ALL_ITEMS_LIST, getProjectViewListKey } from './projectViewOptions.js';

const OPEN_VIEW = { ...SAMPLE_VIEW_BOARD, id: 'PVTV_open', number: 7, name: 'Open', filter: 'is:open' };
const PROJECT: Project = { ...SAMPLE_PROJECT, views: [SAMPLE_VIEW_SPRINT, OPEN_VIEW] };
const ALL_ITEMS_TO = { path: '/orgs/skyline-labs/projects/2/views/1', query: { all: null } };

test('D13, K6: a view not shown reads as changed by what this device keeps of it, as answered by its saved filter', () => {
    const kept = new Set([getProjectViewListKey(PROJECT.id, OPEN_VIEW.id)]);
    const expected: ProjectTab[] = [
        {
            key: SAMPLE_VIEW_SPRINT.id,
            name: 'Current sprint',
            to: '/orgs/skyline-labs/projects/2/views/1',
            current: false,
            modified: false,
            answered: false,
        },
        // `is:open` is left to GitHub while the project holds draft issues.
        {
            key: OPEN_VIEW.id,
            name: 'Open',
            to: '/orgs/skyline-labs/projects/2/views/7',
            current: false,
            modified: true,
            answered: true,
        },
    ];
    expect(tabs({ shownKey: null, isKept: list => kept.has(list), hasDrafts: true })).toEqual(expected);
    expect(tabs({ shownKey: null, hasDrafts: false }).map(tab => tab.answered)).toEqual([false, false]);
});

test('the view shown reads as its page says it stands now, the others as kept', () => {
    const shown = tabs({
        shownKey: SAMPLE_VIEW_SPRINT.id,
        shownState: { modified: true, answered: true },
        hasDrafts: true,
    });
    expect(shown.map(({ key, current, modified, answered }) => ({ key, current, modified, answered }))).toEqual([
        { key: SAMPLE_VIEW_SPRINT.id, current: true, modified: true, answered: true },
        { key: OPEN_VIEW.id, current: false, modified: false, answered: true },
    ]);

    // Without the page — the sidebar — the view shown reads as kept, like the others.
    const kept = new Set([getProjectViewListKey(PROJECT.id, SAMPLE_VIEW_SPRINT.id)]);
    expect(tabs({ shownKey: SAMPLE_VIEW_SPRINT.id, isKept: list => kept.has(list) })[0]).toMatchObject({
        current: true,
        modified: true,
        answered: false,
    });
});

test('K9: "All items" is a tab only while shown, after the saved views, never answered by GitHub', () => {
    expect(tabs({ shownKey: SAMPLE_VIEW_SPRINT.id }).map(tab => tab.key)).toEqual([
        SAMPLE_VIEW_SPRINT.id,
        OPEN_VIEW.id,
    ]);

    const shown = tabs({ shownKey: ALL_ITEMS_LIST, shownState: { modified: true, answered: true } });
    const all: ProjectTab = {
        key: ALL_ITEMS_LIST,
        name: 'All items',
        to: ALL_ITEMS_TO,
        current: true,
        modified: true,
        answered: false,
    };
    expect(shown.map(tab => tab.current)).toEqual([false, false, true]);
    expect(shown[2]).toEqual(all);

    const kept = new Set([getProjectViewListKey(PROJECT.id, ALL_ITEMS_LIST)]);
    expect(tabs({ shownKey: ALL_ITEMS_LIST, isKept: list => kept.has(list) })[2]?.modified).toBe(true);
});

interface TabsOptions extends Partial<Pick<GetProjectViewTabsParams, 'isKept' | 'shownState'>> {
    readonly shownKey: string | null;
    readonly hasDrafts?: boolean;
}

function tabs(options: TabsOptions) {
    return getProjectViewTabs({
        project: PROJECT,
        shownKey: options.shownKey,
        shownState: options.shownState,
        allItems: { name: 'All items', to: ALL_ITEMS_TO },
        isKept: options.isKept ?? (() => false),
        filterContext: {
            viewerLogin: 'kedrzu',
            today: SAMPLE_TODAY,
            hasDrafts: options.hasDrafts ?? false,
            hasDraftPullRequests: false,
        },
    });
}
