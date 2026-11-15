import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { BookMarked, CircleDot, Search } from 'lucide-vue-next';

import CommandCrumbs from './CommandCrumbs.vue';

const meta = {
    component: CommandCrumbs,
    decorators: [
        () => ({
            template: '<div style="display: flex; gap: 8px; align-items: center; padding: 16px"><story /></div>',
        }),
    ],
} satisfies Meta<typeof CommandCrumbs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** An opened item's chip over its action's picker (E2). */
export const OverPicker: Story = {
    args: {
        crumbs: [
            { key: 'chip', label: 'portal#1187', icon: CircleDot, subject: true },
            { key: 'item.status', label: 'Set status', arrow: true },
        ],
    },
};

/** `Workflow / Command step` (W37): the way to a workflow's form, its repository dim after its name. */
export const OverForm: Story = {
    args: {
        crumbs: [
            { key: 'app.runWorkflow', label: 'Run workflow' },
            { key: 'deploy', label: 'Deploy', detail: 'fitloop/webapp', arrow: true },
        ],
    },
};

/** A search's crumb with its icon, after a repository's chip. */
export const SearchCrumb: Story = {
    args: {
        crumbs: [
            { key: 'chip', label: 'skyline-labs/portal', icon: BookMarked, subject: true },
            { key: 'search', label: 'Search repositories', icon: Search },
        ],
    },
};
