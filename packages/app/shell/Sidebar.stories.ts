import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h } from 'vue';
import { useRouter } from 'vue-router';

import MenuItem from '@/components/MenuItem.vue';
import MenuLabel from '@/components/MenuLabel.vue';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';
import type { TrackedTarget } from '@/tracking/TrackingTypes.js';

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

/** On a tracked repository's list of issues (`/kedrzu/githq/issues`): its row is still the current one. */
export const OnRepositoryIssues: Story = {
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => {
                    void useRouter().replace('/kedrzu/githq/issues');
                    return () => h(Story);
                },
            });
        },
    ],
};

/** A tracked project or repository right-clicked: its menu, which the app fills with its actions. */
export const TrackedMenu: Story = {
    render: args => ({
        setup: () => () =>
            h(Sidebar, args, {
                trackedMenu: ({ target }: { target: TrackedTarget }) => [
                    h(MenuLabel, () => (target.kind === 'repository' ? target.nameWithOwner : target.id)),
                    h(MenuItem, () => 'Open on GitHub'),
                ],
            }),
    }),
};

/** Collapsed to the rail of icons. */
export const Collapsed: Story = { args: { collapsed: true } };

function project(title: string, owner: string, number: number, status: SidebarTrackedStatus): SidebarTrackedEntry {
    return {
        key: `project:${number}`,
        label: title,
        to: `/orgs/${owner}/projects/${number}`,
        target: { kind: 'project', id: `PVT_${number}` },
        status,
    };
}

function repository(nameWithOwner: string, status: SidebarTrackedStatus): SidebarTrackedEntry {
    return {
        key: `repository:${nameWithOwner}`,
        label: nameWithOwner,
        to: `/${nameWithOwner}`,
        target: { kind: 'repository', nameWithOwner },
        status,
    };
}
