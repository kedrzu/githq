import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import ProjectSettingsView from './ProjectSettingsView.vue';

const NOW = Date.parse('2026-05-04T12:00:00Z');

const meta = {
    component: ProjectSettingsView,
    args: {
        title: 'Platform Q4',
        owner: 'fitloop',
        status: { kind: 'read', at: NOW - 14_000, slower: false },
        now: NOW,
        openCount: 128,
        onBack: fn(),
        onUntrack: fn(),
    },
    // As tall as Settings' section, like in the app.
    render: args => ({
        components: { ProjectSettingsView },
        setup: () => ({ args }),
        template: '<div style="display: flex; height: 100vh"><ProjectSettingsView v-bind="args" /></div>',
    }),
} satisfies Meta<typeof ProjectSettingsView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T17: a project, synced 14s ago — Tracking alone. */
export const Synced: Story = {};

/** Read less often: GitHub refuses the free check. */
export const Slower: Story = { args: { status: { kind: 'read', at: NOW - 14_000, slower: true } } };

/** Its first download under way. */
export const Downloading: Story = { args: { status: { kind: 'downloading', done: 12, total: 34 }, openCount: 12 } };
