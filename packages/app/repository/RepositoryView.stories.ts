import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { defineComponent, h, shallowRef } from 'vue';

import CommitGraphView from '@/commits/CommitGraphView.vue';
import { foldStacks } from '@/lists/foldStacks.js';
import type { ItemSort } from '@/lists/ItemSort.js';
import type { ListLayout, ListViewOptions } from '@/lists/ListTypes.js';
import type { BrowsedStatus } from '@/repos/BrowsedRepositories.js';
import type { Item } from '@/store/ItemTypes.js';
import { describeStack } from '@/store/stacks/describeStack.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import { sampleWebappHistory } from '@/testing/sampleCommits.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_REPOSITORY, SAMPLE_REPOSITORY_ITEMS } from '@/testing/sampleRepositoryItems.js';
import { SPREAD_STACK_ITEMS } from '@/testing/sampleStacks.js';
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
    milestoneDetail: ({ closed, total }) => `${closed} of ${total} closed`,
};

const meta = {
    component: RepositoryView,
    args: {
        nameWithOwner: SAMPLE_REPOSITORY,
        isPrivate: true,
        tracked: true,
        section: 'issues',
        list: sampleList(SAMPLE_REPOSITORY_ITEMS, 'milestone'),
        openCounts: { issues: 5, pullRequests: 1 },
        projects: [
            { id: 'PVT_q4', title: 'Platform Q4', count: 5, to: '/orgs/skyline-labs/projects/1', external: false },
            {
                id: 'PVT_triage',
                title: 'Bug triage',
                count: 2,
                to: 'https://github.com/orgs/skyline-labs/projects/2',
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
        'onUpdate:section': fn(),
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

/**
 * J1, CH1: a tracked repository's issues as a list grouped by milestone — soonest due first, with progress — and the
 * projects they live in; the tabs count each section's open items.
 */
export const ByMilestone: Story = { args: { selectedId: 'I_1187' } };

/** J2: the issues as a board by issue type. */
export const BoardByIssueType: Story = {
    args: {
        list: sampleList(SAMPLE_REPOSITORY_ITEMS, 'issueType'),
        options: options('board', 'issueType'),
        selectedId: 'I_1187',
    },
};

/** The issues as a board by label: an item with two labels is on both columns. */
export const BoardByLabel: Story = {
    args: { list: sampleList(SAMPLE_REPOSITORY_ITEMS, 'label'), options: options('board', 'label') },
};

/**
 * SP24, SP13: the pull requests by label, a stack spread over two groups and a pull request alone in a third. Each group's entry is a share
 * — "2 of 4", its pull requests' pips filled and the others hollow, how the share stands ("Both ready", "#1206 blocks")
 * — and the lone one is an ordinary row marked "4 of 4", its pip tall.
 */
export const StackSpreadOverLabels: Story = {
    args: {
        nameWithOwner: 'fitloop/webapp',
        section: 'pullRequests',
        list: sampleStackedList(SPREAD_STACK_ITEMS, 'label'),
        openCounts: { issues: 1, pullRequests: SPREAD_STACK_ITEMS.length - 1 },
        projects: [],
        options: options('list', 'label'),
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getAllByText('2 of 4')).toHaveLength(2);
        await expect(canvas.getByText('Both ready')).toBeVisible();
        await expect(canvas.getByText('#1206 blocks')).toBeVisible();
        await expect(canvas.getByText('4 of 4')).toBeVisible();
        await expect(canvas.getByLabelText('In a stack')).toBeVisible();
    },
};

/**
 * SP26 as a repository's board of pull requests (by label; a project's by Status draws the same): the stack spread over
 * two columns, a card in each — "2 of 4", the column's share filled — and the pull request alone in a third, an
 * ordinary card marked "4 of 4". The chevron expands a card: its pull requests are listed inside it, the column still
 * counting it once.
 */
export const StackOnBoard: Story = {
    args: {
        nameWithOwner: 'fitloop/webapp',
        section: 'pullRequests',
        list: sampleStackedList(SPREAD_STACK_ITEMS, 'label'),
        openCounts: { issues: 1, pullRequests: SPREAD_STACK_ITEMS.length - 1 },
        projects: [],
        options: options('board', 'label'),
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getAllByText(/2 of 4/)).toHaveLength(2);
        await expect(canvas.getByText('Both ready')).toBeVisible();
        await expect(canvas.getByText('#1206 blocks')).toBeVisible();
        await expect(canvas.getByText('4 of 4')).toBeVisible();

        // Expanded, the stack's cards list its pull requests inside them: the column's one card stays the share.
        const [expand] = canvas.getAllByRole('button', { name: 'Expand the stack' });
        await userEvent.click(expand ?? canvasElement);
        // Past the first frame of the `Reveal` the members open in.
        await waitFor(() => expect(canvas.getByText('Timezones in the picker')).toBeVisible());
        const frontend = canvas.getByRole('region', { name: 'frontend' });
        await expect(frontend.querySelectorAll('[data-entry-key]')).toHaveLength(1);
    },
};

/** Nothing of the section matches the state chosen. */
export const NothingMatches: Story = {
    args: { list: sampleList([], 'milestone'), openCounts: { issues: 0, pullRequests: 0 }, projects: [] },
};

const ARRIVING_LIST = buildRepositoryList({
    items: [],
    state: 'open',
    kind: 'issue',
    grouping: 'milestone',
    sort: 'updated',
    texts: TEXTS,
    arriving: true,
});

/** Tracked, its open issues still downloading: ghost rows, never "nothing matches" (first run and loading ES14). */
export const TrackedArriving: Story = {
    args: { list: ARRIVING_LIST, openCounts: { issues: 0, pullRequests: 0 }, projects: [] },
};

/** The same as a board: ghost columns, as its columns come from its items (ES29). */
export const TrackedArrivingBoard: Story = {
    args: { ...TrackedArriving.args, options: options('board', 'milestone') },
};

const NOT_TRACKED = {
    nameWithOwner: 'vitejs/vite',
    isPrivate: false,
    tracked: false,
    openCounts: { issues: 0, pullRequests: 0 },
    projects: [],
    withoutProject: 0,
    status: browsedStatus({ total: 3412, hasMore: true, cursor: 'c2' }),
} as const;

/** J5: not tracked, the full view read on demand: the chip, how much of it is read, and no counts on the tabs. */
export const NotTracked: Story = {
    args: NOT_TRACKED,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByText('not tracked')).toBeVisible();
        await expect(canvas.getByText('5 of 3412')).toBeVisible();
    },
};

/** J5, its next page on its way: said after the last row. */
export const NotTrackedReadingMore: Story = {
    args: { ...NOT_TRACKED, status: browsedStatus({ total: 3412, hasMore: true, cursor: 'c2', reading: true }) },
};

/** J6: the board, with one button for the next page, as a column's end says nothing of the rest. */
export const NotTrackedBoard: Story = {
    args: {
        ...NOT_TRACKED,
        list: sampleList(SAMPLE_REPOSITORY_ITEMS, 'issueType'),
        options: options('board', 'issueType'),
    },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByRole('button', { name: 'Read more' })).toBeVisible();
    },
};

/** The first page on its way: still arriving, never a list saying there is nothing. */
export const NotTrackedArriving: Story = {
    args: {
        ...NOT_TRACKED,
        list: ARRIVING_LIST,
        status: browsedStatus({ reading: true }),
    },
};

/** J7: GitHub does not show it: the name, the chip and the way to GitHub. */
export const NotTrackedNotShown: Story = {
    args: {
        ...NOT_TRACKED,
        isPrivate: null,
        list: sampleList([], 'none'),
        status: browsedStatus({ notShown: true }),
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('heading', { name: 'GitHub does not show this repository' })).toBeVisible();
        await expect(canvas.getByRole('link', { name: /^Open on\sGitHub$/ })).toHaveAttribute(
            'href',
            'https://github.com/vitejs/vite',
        );
    },
};

/**
 * CH3, D10: the Commits section has none of the list's tools: the title, the tabs and the way to its history on GitHub,
 * over the graph.
 */
export const Commits: Story = {
    args: { nameWithOwner: 'acme/web', section: 'commits', list: null, projects: [], withoutProject: 0 },
    render: args =>
        defineComponent({
            setup() {
                const { container, ready } = createCommitGraphTest(sampleWebappHistory());
                provideContainer(container);
                const kept = shallowRef(false);
                const showOnceKept = async () => {
                    await ready;
                    kept.value = true;
                };
                void showOnceKept();
                return () =>
                    h(
                        'div',
                        { style: 'display: flex; height: 100vh' },
                        kept.value
                            ? [
                                  h(RepositoryView, args, {
                                      commits: ({ refListInColumn }: { readonly refListInColumn: boolean }) =>
                                          h(CommitGraphView, { nameWithOwner: 'acme/web', refListInColumn }),
                                  }),
                              ]
                            : [],
                    );
            },
        }),
    play: async ({ canvasElement }) => {
        await expect(await findGraphRow(canvasElement)).toBeVisible();
    },
};

/** D11: not tracked, the Commits section shows in full; only the chip says so. */
export const CommitsNotTracked: Story = {
    args: { ...Commits.args, tracked: false },
    render: Commits.render,
    play: async ({ canvasElement }) => {
        await expect(await findGraphRow(canvasElement)).toBeVisible();
    },
};

/** CH4: the column layout on Issues: the sections and the projects its issues live in in the column; the toolbar in the pane. */
export const ColumnIssues: Story = {
    args: { layout: 'column', selectedId: 'I_1187' },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('heading', { name: 'Issues', level: 1 })).toBeVisible();
        await expect(canvas.getByRole('navigation', { name: 'Its issues live in' })).toHaveTextContent(
            '1 in no project',
        );
    },
};

/** CH5: the column layout on Pull requests. */
export const ColumnPullRequests: Story = {
    args: {
        layout: 'column',
        section: 'pullRequests',
        list: sampleList(SAMPLE_REPOSITORY_ITEMS, 'milestone', 'pullRequest'),
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('heading', { name: 'Pull requests', level: 1 })).toBeVisible();
        await expect(canvas.getByRole('navigation', { name: 'Its pull requests live in' })).toBeVisible();
    },
};

/** CH6: the column layout on Commits: the list of branches and tags in the column, the graph the whole pane. */
export const ColumnCommits: Story = {
    args: { ...Commits.args, layout: 'column' },
    render: Commits.render,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(await findGraphRow(canvasElement)).toBeVisible();
        await expect(await canvas.findByRole('combobox', { name: 'Filter branches and tags' })).toBeVisible();
        await expect(canvas.getByRole('heading', { name: 'Commits', level: 1 })).toBeVisible();
    },
};

/** D11, D20: the column layout not tracked: the chip in the column's head, Commits in full. */
export const ColumnCommitsNotTracked: Story = {
    args: { ...ColumnCommits.args, tracked: false },
    render: Commits.render,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(await findGraphRow(canvasElement)).toBeVisible();
        await expect(canvas.getByText('not tracked')).toBeVisible();
    },
};

/** J5, D20: not tracked in the column layout: the chip in the column only, the toolbar and the count in the pane. */
export const ColumnNotTracked: Story = {
    args: { ...NOT_TRACKED, layout: 'column' },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('heading', { name: 'Issues', level: 1 })).toBeVisible();
        await expect(canvas.getAllByText('not tracked')).toHaveLength(1);
        await expect(canvas.getByText('5 of 3412')).toBeVisible();
    },
};

/** CH42: a commit's details in the column layout, on the pane's right, with the list staying in the column. */
export const ColumnCommitDetails: Story = {
    args: ColumnCommits.args,
    render: Commits.render,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await findGraphRow(canvasElement);
        await userEvent.keyboard('{Enter}');
        await expect(await canvas.findByRole('region', { name: 'Commit details' })).toBeVisible();
        await expect(canvas.getByRole('combobox', { name: 'Filter branches and tags' })).toBeVisible();
    },
};

function browsedStatus(status: Partial<BrowsedStatus>): BrowsedStatus {
    return { reading: false, total: null, hasMore: false, cursor: null, notShown: false, settledName: null, ...status };
}

function sampleList(items: readonly Item[], grouping: RepositoryGrouping, kind: Item['kind'] = 'issue') {
    return buildRepositoryList({ items, state: 'open', kind, grouping, sort: 'updated', texts: TEXTS });
}

/** The pull requests as the repository page shows them: a stack's folded per group (D3). */
function sampleStackedList(items: readonly Item[], grouping: RepositoryGrouping) {
    const list = sampleList(items, grouping, 'pullRequest');
    return {
        ...list,
        groups: foldStacks({
            groups: list.groups,
            getPullRequest: item => (item.kind === 'pullRequest' ? item : null),
            stacks: groupStacks(items),
            describe: stack => describeStack({ stack, viewerLogin: SAMPLE_VIEWER.login, getItem: () => undefined }),
        }),
    };
}

function options(layout: ListLayout, grouping: RepositoryGrouping): ListViewOptions<RepositoryGrouping, ItemSort> {
    return { ...REPOSITORY_VIEW_DEFAULTS, layout, grouping };
}

/** A commit's headline in the graph: the open details name it too, when it is a parent of the selected commit. */
async function findGraphRow(canvasElement: HTMLElement) {
    const graph = await within(canvasElement).findByRole('region', { name: /^Commits of/ });
    return within(graph).findByText('chore: bump vite to 6.2');
}
