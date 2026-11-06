import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import CantBeRead from './CantBeRead.vue';

/** 14:20 today, local time. */
const UNTIL = new Date(2026, 10, 6, 14, 20).getTime();

const GROUP = () => ({ template: '<div style="width: 644px"><story /></div>' });
const COLUMN = () => ({ template: '<div style="width: 252px"><story /></div>' });

const meta = {
    component: CantBeRead,
    args: { place: 'screen', cause: { kind: 'offline' }, thing: "fitloop/webapp's issues" },
    decorators: [() => ({ template: '<div style="display: flex; width: 640px; height: 380px"><story /></div>' })],
} satisfies Meta<typeof CantBeRead>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Offline before it arrived: no action, it carries on by itself (D12). */
export const Offline: Story = {};

/** Paused by GitHub's hourly allowance: no action, it comes in at the time. */
export const Paused: Story = { args: { cause: { kind: 'paused', until: UNTIL } } };

/** GitHub failing: "Try again" (R). */
export const Failing: Story = { args: { cause: { kind: 'failing', retry: fn(() => Promise.resolve()) } } };

/** No access or gone: "Open on GitHub" (O). */
export const Hidden: Story = {
    args: { cause: { kind: 'hidden', url: 'https://github.com/fitloop/webapp' }, thing: 'fitloop/webapp' },
};

/** A group not in yet while offline: one amber line. */
export const OfflineGroup: Story = { args: { place: 'group' }, decorators: [GROUP] };

export const PausedGroup: Story = { args: { ...Paused.args, place: 'group' }, decorators: [GROUP] };

/** GitHub failing in a group: a small "Try again", no key, as a list may have several. */
export const FailingGroup: Story = { args: { ...Failing.args, place: 'group' }, decorators: [GROUP] };

export const HiddenGroup: Story = { args: { ...Hidden.args, place: 'group' }, decorators: [GROUP] };

/** A board column not in yet while offline: a small amber note. */
export const OfflineColumn: Story = { args: { place: 'column' }, decorators: [COLUMN] };

export const PausedColumn: Story = { args: { ...Paused.args, place: 'column' }, decorators: [COLUMN] };

export const FailingColumn: Story = { args: { ...Failing.args, place: 'column' }, decorators: [COLUMN] };

export const HiddenColumn: Story = { args: { ...Hidden.args, place: 'column' }, decorators: [COLUMN] };
