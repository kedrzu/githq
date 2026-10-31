import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h } from 'vue';

import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import Sidebar from './Sidebar.vue';
import type { SidebarTrackedEntry, SidebarTrackedStatus } from './Sidebar.vue';

const meta = {
    component: Sidebar,
    args: {
        viewer: SAMPLE_VIEWER,
        collapsed: false,
        counts: { reviewRequested: 2, authored: 3, assigned: 5, mentioned: 3, total: 13 },
        tracked: {
            projects: [
                project('Platform Q4', 'sigma-clinic', 1, { kind: 'count', count: 128 }),
                project('githq Roadmap', 'kedrzu', 2, { kind: 'count', count: 34 }),
                project('Docs revamp', 'sigma-clinic', 3, { kind: 'count', count: 12 }),
            ],
            repositories: [
                repository('kedrzu/githq', { kind: 'count', count: 18 }),
                repository('kedrzu/skills', { kind: 'count', count: 7 }),
                repository('sigma-clinic/portal', { kind: 'count', count: 142 }),
                repository('sigma-clinic/api', { kind: 'count', count: 96 }),
            ],
        },
        onToggle: fn(),
        onSignOut: fn(),
    },
    // As tall as the window, like in the app.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({ setup: () => () => h('div', { style: { height: '100vh' } }, [h(Story)]) });
        },
    ],
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The sidebar expanded: account, search, "My work" and its groups with their counts, projects and repositories. */
export const Expanded: Story = {};

/** Before the first download of "my work": its counts are still arriving. */
export const CountsArriving: Story = { args: { counts: null } };

/** The first download of the tracked ones under way: how far each is, or waiting for its turn. */
export const Downloading: Story = {
    args: {
        tracked: {
            projects: [project('githq Roadmap', 'kedrzu', 2, { kind: 'count', count: 34 })],
            repositories: [
                repository('kedrzu/githq', { kind: 'count', count: 18 }),
                repository('sigma-clinic/portal', { kind: 'downloading', percent: 62 }),
                repository('sigma-clinic/api', { kind: 'downloading', percent: null }),
                repository('acme-health/vault', { kind: 'hidden' }),
            ],
        },
    },
};

/** Nothing tracked yet: the sections offer to track some. */
export const NothingTracked: Story = { args: { tracked: { projects: [], repositories: [] } } };

/** Collapsed to the rail of icons. */
export const Collapsed: Story = { args: { collapsed: true } };

function project(title: string, owner: string, number: number, status: SidebarTrackedStatus): SidebarTrackedEntry {
    return { key: `project:${number}`, label: title, to: `/orgs/${owner}/projects/${number}`, status };
}

function repository(nameWithOwner: string, status: SidebarTrackedStatus): SidebarTrackedEntry {
    return { key: `repository:${nameWithOwner}`, label: nameWithOwner, to: `/${nameWithOwner}`, status };
}
