import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import SavingStopped from './SavingStopped.vue';

const meta = {
    component: SavingStopped,
    args: {
        reason: { kind: 'deleted' },
        login: 'mlaine',
        retry: fn(() => Promise.resolve()),
        onReload: fn(),
    },
    decorators: [() => ({ template: '<div style="max-width: 680px; padding: 24px"><story /></div>' })],
} satisfies Meta<typeof SavingStopped>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T7, T8: the repository was deleted — nothing to open, turning off is the way out. */
export const Deleted: Story = {};

/** T8: a repository of that name without githq's file. */
export const Foreign: Story = { args: { reason: { kind: 'foreign' } } };

/** T8: the repository is public. */
export const Public: Story = { args: { reason: { kind: 'public' } } };

/** T8: the file can't be read. */
export const Unreadable: Story = { args: { reason: { kind: 'unreadable' } } };

/** T8: the file comes from a newer githq: Reload. */
export const Newer: Story = { args: { reason: { kind: 'newer', version: 2 } } };

/** T8: GitHub refused, in its own words. */
export const Refused: Story = { args: { reason: { kind: 'refused', message: 'Repository creation failed.' } } };
