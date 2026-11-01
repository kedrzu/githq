import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h } from 'vue';
import { useRouter } from 'vue-router';

import MenuItem from '@/components/MenuItem.vue';
import MenuLabel from '@/components/MenuLabel.vue';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';
import type { TrackedTarget } from '@/tracking/TrackingTypes.js';

import Sidebar from './Sidebar.vue';
import type { SidebarTrackedEntry, SidebarTrackedStatus } from './Sidebar.vue';

/** As tall as the window and as wide as the panel it has in the app. */
const asInTheApp: Decorator = (story, { args }) => {
    const Story = story();
    const width = args.collapsed ? '56px' : '236px';
    return defineComponent({ setup: () => () => h('div', { style: { width, height: '100vh' } }, [h(Story)]) });
};

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
                repository('sigma-clinic/portal', { kind: 'count', count: 142 }, true),
                repository('sigma-clinic/api', { kind: 'count', count: 96 }, true),
            ],
        },
        onToggle: fn(),
        onSignOut: fn(),
    },
    decorators: [asInTheApp],
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sidebar expanded: the logo, search, "My work" and its groups with their counts, projects and repositories —
 * the private ones with a lock — and the signed-in user at the bottom.
 */
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
                repository('sigma-clinic/portal', { kind: 'downloading', percent: 62 }, true),
                repository('sigma-clinic/api', { kind: 'downloading', percent: null }, true),
                repository('acme-health/vault', { kind: 'hidden' }),
            ],
        },
    },
};

/** Repositories only: no Projects section. */
export const NoProjects: Story = {
    args: { tracked: { projects: [], repositories: [repository('kedrzu/githq', { kind: 'count', count: 18 })] } },
};

/** Projects only: no Repositories section. */
export const NoRepositories: Story = {
    args: {
        tracked: { projects: [project('githq Roadmap', 'kedrzu', 2, { kind: 'count', count: 34 })], repositories: [] },
    },
};

/** Nothing tracked yet: a note and the way to Settings where the lists would be. */
export const NothingTracked: Story = { args: { tracked: { projects: [], repositories: [] } } };

/** More tracked than the window holds: the lists scroll, the user stays at the bottom. */
export const LongLists: Story = {
    args: {
        tracked: {
            projects: [],
            repositories: Array.from({ length: 60 }, (_, index) =>
                repository(`kedrzu/repository-${index}`, { kind: 'count', count: index }),
            ),
        },
    },
};

/** A login too long for the row: it ends in an ellipsis. */
export const LongLogin: Story = {
    args: { viewer: { ...SAMPLE_VIEWER, login: 'a-very-long-login-that-the-sidebar-cannot-hold-whole' } },
};

/** On a tracked repository's list of issues (`/kedrzu/githq/issues`): its row is still the current one. */
export const OnRepositoryIssues: Story = { decorators: [onPage('/kedrzu/githq/issues')] };

const renderWithTrackedMenu: Story['render'] = args => ({
    setup: () => () =>
        h(Sidebar, args, {
            trackedMenu: ({ target }: { target: TrackedTarget }) => [
                h(MenuLabel, () => (target.kind === 'repository' ? target.nameWithOwner : target.id)),
                h(MenuItem, () => 'Open on GitHub'),
            ],
        }),
});

/** A tracked project or repository right-clicked: its menu, which the app fills with its actions. */
export const TrackedMenu: Story = { render: renderWithTrackedMenu };

/** Collapsed to the rail of icons, with a mark for each tracked project. */
export const Collapsed: Story = { args: { collapsed: true } };

/** On the rail, a tracked project's page: its mark is the current one. */
export const CollapsedOnProject: Story = {
    args: { collapsed: true },
    decorators: [onPage('/orgs/kedrzu/projects/2')],
};

/** A project's mark on the rail right-clicked: the same menu as its row's. */
export const CollapsedTrackedMenu: Story = { args: { collapsed: true }, render: renderWithTrackedMenu };

/** The rail with repositories only: no marks, no divider for them. */
export const CollapsedNoProjects: Story = {
    args: { ...NoProjects.args, collapsed: true },
};

/** The rail with more marks than fit: they scroll, under the logo and search. */
export const CollapsedManyProjects: Story = {
    args: {
        collapsed: true,
        tracked: {
            projects: Array.from({ length: 60 }, (_, index) =>
                project(`Project ${index}`, 'kedrzu', index, { kind: 'count', count: index }),
            ),
            repositories: [],
        },
    },
};

/** The rail with nothing tracked: the way to Settings instead of the marks. */
export const CollapsedNothingTracked: Story = {
    args: { ...NothingTracked.args, collapsed: true },
};

/** A decorator opening the story at an address. */
function onPage(path: string): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup: () => {
                void useRouter().replace(path);
                return () => h(Story);
            },
        });
    };
}

function project(title: string, owner: string, number: number, status: SidebarTrackedStatus): SidebarTrackedEntry {
    return {
        key: `project:${number}`,
        label: title,
        to: `/orgs/${owner}/projects/${number}`,
        target: { kind: 'project', id: `PVT_${number}` },
        status,
    };
}

function repository(nameWithOwner: string, status: SidebarTrackedStatus, isPrivate = false): SidebarTrackedEntry {
    return {
        key: `repository:${nameWithOwner}`,
        label: nameWithOwner,
        to: `/${nameWithOwner}`,
        target: { kind: 'repository', nameWithOwner },
        status,
        isPrivate,
    };
}
