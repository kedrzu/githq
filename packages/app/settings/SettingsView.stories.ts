import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import SettingsView from './SettingsView.vue';

const meta = {
    component: SettingsView,
    args: {
        section: 'repositories',
        trackedRepositories: 15,
        trackedProjects: 2,
        'onUpdate:section': fn(),
    },
    // As tall as the window, like in the app.
    render: args => ({
        components: { SettingsView },
        setup: () => ({ args }),
        template: '<div style="display: flex; height: 100vh"><SettingsView v-bind="args" /></div>',
    }),
} satisfies Meta<typeof SettingsView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** G8: the title, and the tabs with what is tracked counted. */
export const Repositories: Story = {};

/** G8: on Projects. */
export const Projects: Story = { args: { section: 'projects' } };

/** D22: on Display. */
export const Display: Story = { args: { section: 'display' } };

/** T4: on a section with no count. */
export const SyncSettings: Story = { args: { section: 'sync' } };

/** T7: syncing stopped, the tab says so with an amber dot. */
export const SyncStopped: Story = { args: { section: 'sync', savingStopped: true } };

/** A narrow window: the tabs keep the room. */
export const NarrowWindow: Story = {
    decorators: [() => ({ template: '<div style="width: 560px"><story /></div>' })],
};

/** Nothing tracked yet: the counts say so. */
export const NothingTracked: Story = { args: { trackedRepositories: 0, trackedProjects: 0 } };
