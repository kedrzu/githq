import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import RepositorySettingsView from './RepositorySettingsView.vue';

const NOW = Date.parse('2026-05-04T12:00:00Z');

const meta = {
    component: RepositorySettingsView,
    args: {
        nameWithOwner: 'fitloop/webapp',
        isPrivate: true,
        status: { kind: 'read', at: NOW - 14_000, slower: false },
        now: NOW,
        openCount: 142,
        onBack: fn(),
        onUntrack: fn(),
    },
    // As tall as Settings' section, like in the app.
    render: args => ({
        components: { RepositorySettingsView },
        setup: () => ({ args }),
        template: '<div style="display: flex; height: 100vh"><RepositorySettingsView v-bind="args" /></div>',
    }),
} satisfies Meta<typeof RepositorySettingsView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T16: a private repository, synced 14s ago. */
export const Synced: Story = {};

/** A public one. */
export const Public: Story = { args: { nameWithOwner: 'mlaine/tasklet', isPrivate: false, openCount: 18 } };

/** No item of it arrived yet: the head says neither private nor public. */
export const VisibilityNotKnown: Story = {
    args: { isPrivate: null, status: { kind: 'downloading', done: 0, total: null }, openCount: 0 },
};

/** Its first download under way. */
export const Downloading: Story = { args: { status: { kind: 'downloading', done: 40, total: 312 }, openCount: 40 } };

/** GitHub refuses its changes (amber). */
export const Refused: Story = { args: { status: { kind: 'refused' } } };

/** GitHub no longer shows it (amber). */
export const Hidden: Story = { args: { status: { kind: 'hidden' } } };
