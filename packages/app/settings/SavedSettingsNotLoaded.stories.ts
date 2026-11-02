import type { Meta, StoryObj } from '@storybook/vue3-vite';

import SavedSettingsNotLoaded from './SavedSettingsNotLoaded.vue';

const meta = {
    component: SavedSettingsNotLoaded,
    args: { reason: null, repository: 'mlaine/githq-settings' },
    decorators: [() => ({ template: '<div style="max-width: 980px; padding: 24px"><story /></div>' })],
} satisfies Meta<typeof SavedSettingsNotLoaded>;

export default meta;

type Story = StoryObj<typeof meta>;

/** G13: the saved settings declined. */
export const Declined: Story = {};

/** G14: a repository of that name that isn't githq's. */
export const Foreign: Story = { args: { reason: { kind: 'foreign' } } };

/** G14: the repository is public. */
export const Public: Story = { args: { reason: { kind: 'public' } } };
