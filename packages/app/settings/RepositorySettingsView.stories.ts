import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SAMPLE_WORKFLOWS_NOW, sampleStoredWorkflows } from '@/testing/sampleWorkflows.js';

import RepositorySettingsView from './RepositorySettingsView.vue';

const NOW = SAMPLE_WORKFLOWS_NOW;

/**
 * The design's fitloop/webapp (actions W7): Deploy broken on main and passed on the branch v2-experiment, Release
 * failed on the tag v0.1.0-rc.3 after passing on rc.1 and rc.2, Nightly e2e failing on staging.
 */
const WORKFLOWS = sampleStoredWorkflows({
    nameWithOwner: 'fitloop/webapp',
    workflows: [
        {
            id: 1,
            name: 'Deploy',
            runs: [
                { conclusion: 'success', ago: '2d', branch: 'chore/deploy-workflow' },
                { conclusion: 'success', ago: '1d', branch: 'v2-experiment' },
                { conclusion: 'success', ago: '20h' },
                { conclusion: 'failure', ago: '2h' },
            ],
        },
        { id: 2, name: 'Probe', runs: [{ conclusion: 'success', ago: '1h' }] },
        { id: 3, name: 'Test', runs: [{ conclusion: 'success', ago: '2h' }] },
        {
            id: 4,
            name: 'Release',
            runs: [
                { conclusion: 'success', ago: '3d', branch: 'v0.1.0-rc.1' },
                { conclusion: 'success', ago: '2d', branch: 'v0.1.0-rc.2' },
                { conclusion: 'failure', ago: '6h', branch: 'v0.1.0-rc.3' },
            ],
        },
        { id: 5, name: 'Nightly e2e', runs: [{ conclusion: 'failure', ago: '5h', branch: 'staging' }] },
        { id: 6, name: 'Dependabot Updates', path: 'dynamic/dependabot', runs: [{ conclusion: 'success', ago: '3h' }] },
    ],
});

const meta = {
    component: RepositorySettingsView,
    args: {
        nameWithOwner: 'fitloop/webapp',
        isPrivate: true,
        status: { kind: 'read', at: NOW - 14_000, slower: false },
        now: NOW,
        openCount: 142,
        workflows: WORKFLOWS,
        workflowSettings: { defaultBranch: true, refs: [] },
        onBack: fn(),
        onUntrack: fn(),
        onWorkflowSettings: fn(),
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

/** T16: a private repository, synced 14s ago; workflow alerts on the default: its default branch alone. */
export const Synced: Story = {};

/** W7: main plus `v*`, which catches the branch v2-experiment beside the release candidates. */
export const WithPattern: Story = { args: { workflowSettings: { defaultBranch: true, refs: ['v*'] } } };

/** W8: `release/*` matches no ref githq has seen a run on yet. */
export const MatchingNothing: Story = { args: { workflowSettings: { defaultBranch: true, refs: ['release/*'] } } };

/** W9: the default branch switched off and no patterns: no alerts at all. */
export const AlertsOff: Story = { args: { workflowSettings: { defaultBranch: false, refs: [] } } };

/** W10: just tracked, with `v*` brought from another computer: no runs read, so no matches and no counts. */
export const NotRead: Story = {
    args: {
        status: { kind: 'downloading', done: 0, total: null },
        openCount: 0,
        workflows: undefined,
        workflowSettings: { defaultBranch: true, refs: ['v*'] },
    },
};

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
