import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { EMPTY_SETTINGS_DOCUMENT } from './sync/SettingsDocument.js';
import SavingView from './SavingView.vue';

const NOW = Date.parse('2026-11-01T12:00:00Z');

const meta = {
    component: SavingView,
    args: {
        login: 'mlaine',
        saving: { state: 'off' },
        connect: { kind: 'idle' },
        repositories: 15,
        projects: 3,
        now: NOW,
        turnOn: fn(() => Promise.resolve()),
        combine: fn(() => Promise.resolve()),
        retry: fn(() => Promise.resolve()),
        onCancel: fn(),
        onTurnOff: fn(),
        onReload: fn(),
    },
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SavingView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T3: off, the default. */
export const Off: Story = {};

/** Ticked: GitHub is asked whether the repository is there, or it is being created. */
export const Asking: Story = { args: { connect: { kind: 'busy' } } };

/** T6: the repository already exists; nothing changes until "Combine and turn on". */
export const Combining: Story = {
    args: {
        connect: {
            kind: 'found',
            combining: {
                download: ['fitloop/mobile', 'Docs revamp'],
                saved: ['mlaine/dotfiles'],
                untracked: [{ name: 'acme/api', items: 1240 }],
            },
        },
    },
};

/** T6 with nothing untracked here: that group isn't shown. */
export const CombiningNothingLost: Story = {
    args: { connect: { kind: 'found', combining: { download: ['fitloop/mobile'], saved: [], untracked: [] } } },
};

/** A repository that can't be used, met when ticking: why, and saving stays off. */
export const Unusable: Story = { args: { connect: { kind: 'unusable', reason: { kind: 'public' } } } };

/** GitHub out of reach when ticking. */
export const Unreachable: Story = { args: { connect: { kind: 'unreachable' } } };

/** T4: on. */
export const On: Story = {
    args: {
        saving: { state: 'on', base: EMPTY_SETTINGS_DOCUMENT, sha: 'abc', etag: null, syncedAt: NOW - 2 * 60_000 },
    },
};

/** T5: just turned off: the repository is still there. */
export const TurnedOff: Story = { args: { saving: { state: 'off', repositoryLeft: true } } };

/** T7: syncing stopped, the repository deleted. */
export const Stopped: Story = {
    args: {
        saving: {
            state: 'stopped',
            reason: { kind: 'deleted' },
            base: EMPTY_SETTINGS_DOCUMENT,
            sha: 'abc',
            syncedAt: NOW - 3 * 3_600_000,
        },
    },
};
