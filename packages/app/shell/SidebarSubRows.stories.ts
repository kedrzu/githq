import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import { sampleGetChildren } from '@/testing/samplePlaces.js';

import SidebarSubRows from './SidebarSubRows.vue';

const PORTAL = { kind: 'repository', nameWithOwner: 'skyline-labs/portal' } as const;
const PLATFORM = { kind: 'project', id: 'PVT_1' } as const;

/** As wide as the places panel, on its background. */
const inThePlacesPanel: Decorator = story => {
    const Story = story();
    return defineComponent({
        setup: () => () =>
            h('div', { style: { width: '320px', padding: '0 10px', background: '#151b23' } }, [h(Story)]),
    });
};

const meta = {
    component: SidebarSubRows,
    args: { entries: sampleGetChildren({ open: PORTAL, current: 'pullRequests' })(PORTAL) },
    decorators: [inThePlacesPanel],
} satisfies Meta<typeof SidebarSubRows>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Phone / Place row · sub-row` (MB270): a repository's sections, Pull requests current, Commits and Workflows leaving for github.com. */
export const RepositorySections: Story = {};

/** A project's saved views: no counts, a cloud on the one GitHub answers, a dot on the one changed here. */
export const ProjectViews: Story = {
    args: { entries: sampleGetChildren({ open: PLATFORM, current: 'view-1' })(PLATFORM) },
};
