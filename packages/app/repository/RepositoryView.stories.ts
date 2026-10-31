import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import type { ItemSort } from '@/lists/ItemSort.js';
import type { ListLayout, ListViewOptions } from '@/lists/ListTypes.js';
import type { Item } from '@/store/ItemTypes.js';
import { D1_ITEMS, SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_REPOSITORY, SAMPLE_REPOSITORY_ITEMS } from '@/testing/sampleRepositoryItems.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import type { RepositoryListTexts } from './buildRepositoryList.js';
import { buildRepositoryList } from './buildRepositoryList.js';
import RepositoryView from './RepositoryView.vue';
import type { RepositoryGrouping } from './repositoryViewOptions.js';
import { REPOSITORY_VIEW_DEFAULTS } from './repositoryViewOptions.js';

const TEXTS: RepositoryListTexts = {
    all: 'All',
    noMilestone: 'No milestone',
    noLabel: 'No label',
    unassigned: 'Unassigned',
    noType: 'No type',
    issues: 'Issues',
    pullRequests: 'Pull requests',
    milestoneDetail: ({ closed, total }) => `${closed} of ${total} closed`,
};

const meta = {
    component: RepositoryView,
    args: {
        nameWithOwner: SAMPLE_REPOSITORY,
        isPrivate: true,
        tracked: true,
        list: sampleList(SAMPLE_REPOSITORY_ITEMS, 'milestone'),
        openCount: 6,
        projects: [
            { id: 'PVT_q4', title: 'Platform Q4', count: 5, to: '/orgs/sigma-clinic/projects/1', external: false },
            {
                id: 'PVT_triage',
                title: 'Bug triage',
                count: 2,
                to: 'https://github.com/orgs/sigma-clinic/projects/2',
                external: true,
            },
        ],
        withoutProject: 1,
        viewerLogin: SAMPLE_VIEWER.login,
        now: SAMPLE_NOW,
        options: REPOSITORY_VIEW_DEFAULTS,
        selectedId: null,
        'onUpdate:options': fn(),
        'onUpdate:selectedId': fn(),
        onTrack: fn(),
        onMove: fn(),
    },
    // As tall as the window, like in the app.
    render: args => ({
        components: { RepositoryView },
        setup: () => ({ args }),
        template: '<div style="display: flex; height: 100vh"><RepositoryView v-bind="args" /></div>',
    }),
} satisfies Meta<typeof RepositoryView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** J1: a tracked repository as a list grouped by milestone — soonest due first, with progress — and its projects. */
export const ByMilestone: Story = { args: { selectedId: 'I_1187' } };

/** J2: as a board by issue type; the pull request has no type. */
export const BoardByIssueType: Story = {
    args: {
        list: sampleList(SAMPLE_REPOSITORY_ITEMS, 'issueType'),
        options: options('board', 'issueType'),
        selectedId: 'I_1187',
    },
};

/** As a board by label: an item with two labels is on both columns. */
export const BoardByLabel: Story = {
    args: { list: sampleList(SAMPLE_REPOSITORY_ITEMS, 'label'), options: options('board', 'label') },
};

/** Nothing matches the state and kind chosen. */
export const NothingMatches: Story = { args: { list: sampleList([], 'milestone'), openCount: 0, projects: [] } };

/** J3: opened without being tracked — only what concerns the user is here; "Track" brings the rest. */
export const NotTracked: Story = {
    args: {
        nameWithOwner: 'vitejs/vite',
        isPrivate: false,
        tracked: false,
        list: sampleList(
            D1_ITEMS.filter(item => item.repository.nameWithOwner === 'vitejs/vite'),
            'none',
        ),
    },
};

/** J3 when GitHub shows no such repository to track. */
export const NotFound: Story = {
    args: { nameWithOwner: 'acme/gone', isPrivate: null, tracked: false, list: sampleList([], 'none'), notFound: true },
};

function sampleList(items: readonly Item[], grouping: RepositoryGrouping) {
    return buildRepositoryList({ items, state: 'open', kind: 'all', grouping, sort: 'updated', texts: TEXTS });
}

function options(layout: ListLayout, grouping: RepositoryGrouping): ListViewOptions<RepositoryGrouping, ItemSort> {
    return { ...REPOSITORY_VIEW_DEFAULTS, layout, grouping };
}
