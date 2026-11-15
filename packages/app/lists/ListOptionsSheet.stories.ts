import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ListFilter } from 'lucide-vue-next';
import { fn } from 'storybook/test';

import { getProjectViewDefaults } from '@/projects/projectViewOptions.js';
import { SAMPLE_PROJECT, SAMPLE_PROJECT_ENTRIES, SAMPLE_VIEW_SPRINT } from '@/testing/sampleProject.js';
import { sampleProjectView } from '@/testing/sampleProjectView.js';

import ListOptionsSheet from './ListOptionsSheet.vue';
import type { ListChoice } from './ListTypes.js';

const sprint = sampleProjectView({
    project: SAMPLE_PROJECT,
    view: SAMPLE_VIEW_SPRINT,
    entries: SAMPLE_PROJECT_ENTRIES,
});

/** A project's groupings in a list: GitHub's own, then its fields (`ProjectView`). */
const PROJECT_GROUPINGS: ListChoice[] = [
    { value: 'none', label: 'None' },
    { value: 'repository', label: 'Repository' },
    { value: 'milestone', label: 'Milestone' },
    { value: 'assignees', label: 'Assignees' },
    ...SAMPLE_PROJECT.fields
        .filter(field => field.kind !== 'multiSelect')
        .map(field => ({ value: `field:${field.id}`, label: field.name })),
];

/** The orders of a repository and my work: no direction. */
const ITEM_SORTS: ListChoice[] = [
    { value: 'updated', label: 'Updated' },
    { value: 'created', label: 'Created' },
    { value: 'number', label: 'Number' },
    { value: 'title', label: 'Title' },
];

const meta = {
    component: ListOptionsSheet,
    args: {
        open: true,
        title: 'Current sprint',
        place: SAMPLE_PROJECT.title,
        groupings: PROJECT_GROUPINGS,
        sorts: sprint.sorts,
        options: sprint.options,
        gitHubView: `${SAMPLE_PROJECT.url}/views/${SAMPLE_VIEW_SPRINT.number}`,
        'onUpdate:open': fn(),
        'onUpdate:options': fn(),
        onReset: fn(),
        onClearFilter: fn(),
    },
} satisfies Meta<typeof ListOptionsSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * MB173: a project's saved view — its filter from GitHub as a chip, grouped by Status, ordered by Priority (its chip
 * says which way), the view on github.com.
 */
export const ProjectView: Story = {};

/** MB224: the view changed on this device — grouped by Priority — with Back to GitHub's view at the top. */
export const ChangedProjectView: Story = {
    args: { options: { ...sprint.options, grouping: 'field:F_priority' }, modified: true },
};

/** A board view (mobile D9): grouped by its columns' field, so only the fields that can make columns are offered. */
export const BoardView: Story = {
    args: {
        title: 'Board',
        groupings: SAMPLE_PROJECT.fields
            .filter(field => field.kind === 'singleSelect' || field.kind === 'iteration')
            .map(field => ({ value: `field:${field.id}`, label: field.name })),
        options: { ...getProjectViewDefaults(SAMPLE_PROJECT, SAMPLE_VIEW_SPRINT).options, layout: 'board', filter: '' },
    },
};

/** MB174: a repository's issues — GitHub's groupings, the state as a row of chips, no direction on the orders. */
export const Repository: Story = {
    args: {
        title: 'Issues',
        place: 'fitloop/webapp',
        groupings: [
            { value: 'none', label: 'None' },
            { value: 'milestone', label: 'Milestone' },
            { value: 'assignee', label: 'Assignee' },
            { value: 'author', label: 'Author' },
            { value: 'status', label: 'Status' },
            { value: 'label', label: 'Label' },
            { value: 'issueType', label: 'Issue type' },
        ],
        sorts: ITEM_SORTS,
        filters: [
            {
                kind: 'menu',
                key: 'state',
                label: 'State',
                icon: ListFilter,
                title: 'Open',
                choices: [
                    { value: 'open', label: 'Open' },
                    { value: 'closed', label: 'Closed' },
                    { value: 'all', label: 'All' },
                ],
                value: 'open',
                choose: fn(),
            },
        ],
        options: { layout: 'list', grouping: 'milestone', sort: 'updated', properties: [] },
        gitHubView: null,
    },
};

/** MB175: my work — githq's own list, "on this device"; its filters are the strip under the top bar, so no row here. */
export const MyWork: Story = {
    args: {
        title: 'My work',
        place: undefined,
        groupings: [
            { value: 'reason', label: 'Reason' },
            { value: 'repository', label: 'Repository' },
            { value: 'status', label: 'Status' },
            { value: 'author', label: 'Author' },
        ],
        sorts: ITEM_SORTS,
        options: { layout: 'list', grouping: 'reason', sort: 'updated', properties: [] },
        gitHubView: null,
    },
};

/** My work changed on this device: the same line, with Reset. */
export const ChangedMyWork: Story = {
    args: {
        ...MyWork.args,
        options: { layout: 'list', grouping: 'author', sort: 'created', properties: [] },
        modified: true,
    },
};
