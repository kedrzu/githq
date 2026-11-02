import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import SettingsView from './SettingsView.vue';

const meta = {
    component: SettingsView,
    args: {
        section: 'repositories',
        repositories: 15,
        projects: 3,
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

/** G8: the title, the tabs with what is tracked counted, and the keys that switch them. */
export const Repositories: Story = {};

/** T4: on a section with no count. */
export const SavingToGitHub: Story = { args: { section: 'saving' } };

/** Nothing tracked yet: the counts say so. */
export const NothingTracked: Story = { args: { repositories: 0, projects: 0 } };
