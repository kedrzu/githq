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

/** G8: the column with what is tracked counted, the page's header holding the section's name. */
export const Repositories: Story = {};

/** T17: on Projects. */
export const Projects: Story = { args: { section: 'projects' } };

/** CH43: on Display. */
export const Display: Story = { args: { section: 'display' } };

/** CR77: on Code review. */
export const CodeReview: Story = { args: { section: 'review' } };

/** T4: on a section with no count. */
export const SyncSettings: Story = { args: { section: 'sync' } };

/** T7: syncing stopped, its row says so with an amber dot. */
export const SyncStopped: Story = { args: { section: 'sync', savingStopped: true } };

/** G9: on Account. */
export const Account: Story = { args: { section: 'account' } };

/** A narrow window: the column keeps its width, the page gives way. */
export const NarrowWindow: Story = {
    decorators: [() => ({ template: '<div style="width: 560px"><story /></div>' })],
};

/** Nothing tracked yet: the counts say so. */
export const NothingTracked: Story = { args: { trackedRepositories: 0, trackedProjects: 0 } };
