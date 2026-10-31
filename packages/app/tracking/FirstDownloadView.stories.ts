import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import type { FirstDownloadRow } from './FirstDownloadView.vue';
import FirstDownloadView from './FirstDownloadView.vue';
import type { TrackingProgress } from './TrackingTypes.js';

const ROWS: FirstDownloadRow[] = [
    repository('kedrzu/githq', false, { state: 'done', done: 430, total: 430 }),
    ...['skills', 'dotfiles', 'blog', 'notes', 'cv', 'talks', 'snippets', 'aoc-2025', 'homelab', 'recipes', 'nvim'].map(
        name => repository(`kedrzu/${name}`, false, { state: 'done', done: 20, total: 20 }),
    ),
    repository('sigma-clinic/portal', true, { state: 'downloading', done: 880, total: 1420 }),
    repository('sigma-clinic/api', true, { state: 'downloading', done: 210, total: 1160 }),
    {
        kind: 'project',
        key: 'project:PVT_1',
        name: 'githq Roadmap',
        isPrivate: false,
        progress: { state: 'done', done: 34, total: 34 },
    },
    { kind: 'organization', key: 'organization:acme-health', name: 'acme-health' },
];

const meta = {
    component: FirstDownloadView,
    args: {
        myWork: { reviewRequested: 2, authored: 3, assigned: 5, mentioned: 3, total: 13 },
        rows: ROWS,
        overall: { done: 1642, total: 3020, secondsLeft: 40, finished: false },
        onOpen: fn(),
    },
    render: args => ({
        components: { FirstDownloadView },
        setup: () => ({ args }),
        template: '<FirstDownloadView v-bind="args" />',
    }),
} satisfies Meta<typeof FirstDownloadView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** G6: the user's work is in — "Open My work" — while the rest arrives; the finished repositories folded. */
export const WorkReady: Story = {};

/** Seconds after "Track these": the user's own work is still arriving, so it cannot be opened yet. */
export const WorkArriving: Story = {
    args: {
        myWork: null,
        rows: [
            repository('kedrzu/githq', false, { state: 'downloading', done: 0, total: null }),
            repository('sigma-clinic/portal', true, { state: 'downloading', done: 0, total: null }),
        ],
        overall: { done: 0, total: null, secondsLeft: null, finished: false },
    },
};

function repository(name: string, isPrivate: boolean, progress: TrackingProgress): FirstDownloadRow {
    return { kind: 'repository', key: `repository:${name}`, name, isPrivate, progress };
}
