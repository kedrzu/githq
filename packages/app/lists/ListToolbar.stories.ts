import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { h } from 'vue';

import MenuItem from '@/components/MenuItem.vue';
import MenuLabel from '@/components/MenuLabel.vue';

import ListToolbar from './ListToolbar.vue';

const meta = {
    component: ListToolbar,
    args: {
        title: 'Platform Q4',
        groupings: [
            { value: 'none', label: 'None' },
            { value: 'status', label: 'Status' },
        ],
        sorts: [{ value: 'updated', label: 'Updated' }],
        properties: [{ value: 'assignees', label: 'Assignees' }],
        options: { layout: 'list', grouping: 'status', sort: 'updated', properties: ['assignees'] },
    },
} satisfies Meta<typeof ListToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A list that is no repository or project (my work): the title is plain text. */
export const PlainTitle: Story = {};

/** A repository's or a project's view (R1, R2): the title opens its menu, which the page fills. */
export const TitleMenu: Story = {
    render: args => ({
        setup: () => () =>
            h(ListToolbar, args, {
                titleMenu: () => [h(MenuLabel, () => 'Platform Q4 · fitloop'), h(MenuItem, () => 'Open on GitHub')],
            }),
    }),
};
