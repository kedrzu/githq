import type { Meta, StoryObj } from '@storybook/vue3-vite';

import SettingsSectionsList from './SettingsSectionsList.vue';

const meta = {
    component: SettingsSectionsList,
    args: {
        trackedRepositories: 15,
        trackedProjects: 3,
        animations: true,
        reviewCommentChoice: 'single',
        usageStatistics: true,
        saving: 'on',
        login: 'mlaine',
    },
    // A phone's screen.
    render: args => ({
        components: { SettingsSectionsList },
        setup: () => ({ args }),
        template: '<div style="width: 390px"><SettingsSectionsList v-bind="args" /></div>',
    }),
} satisfies Meta<typeof SettingsSectionsList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** MB146: the sections grouped, each saying its state. */
export const Sections: Story = {};

/** Animations, statistics and saving off, comments into a draft review. */
export const Off: Story = {
    args: { animations: false, usageStatistics: false, saving: 'off', reviewCommentChoice: 'draft' },
};

/** Syncing the settings stopped: its row says so in amber. */
export const SavingStopped: Story = { args: { saving: 'stopped' } };

/** Nothing tracked yet, who is signed in not known. */
export const NothingTracked: Story = { args: { trackedRepositories: 0, trackedProjects: 0, login: null } };
