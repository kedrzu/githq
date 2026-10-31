import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Check } from 'lucide-vue-next';
import { userEvent, within } from 'storybook/test';
import { h } from 'vue';

import StatusBar from './StatusBar.vue';
import StatusSegment from './StatusSegment.vue';

const meta = {
    component: StatusBar,
    args: {
        rateLimit: { resource: 'graphql', limit: 5000, remaining: 4812, resetAt: new Date('2026-10-30T15:00:00Z') },
        collapsed: false,
    },
    // With a surface's segment next to the sidebar's.
    render: args => ({
        setup: () => () => h(StatusBar, args, { default: () => h(StatusSegment, { icon: Check }, () => 'Up to date') }),
    }),
} satisfies Meta<typeof StatusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Under the expanded sidebar: the API allowance in full; a surface's segment next to it. */
export const Expanded: Story = {};

/** Under the rail: the allowance in short. */
export const Collapsed: Story = { args: { collapsed: true } };

/** Before GitHub's first answer: the sidebar's segment is empty. */
export const NoAllowanceYet: Story = { args: { rateLimit: null } };

/** Offline: the sidebar's segment says so for the whole app, in amber. */
export const Offline: Story = {
    args: { notice: { kind: 'offline', since: new Date('2026-10-30T14:06:00').getTime() } },
};

/** K3, the allowance used up: refresh is paused until it resets; the segment opens why. */
export const Paused: Story = {
    args: {
        // What githq keeps for the user's edits is left (`EDIT_RESERVE`).
        notice: {
            kind: 'paused',
            until: new Date('2026-10-30T14:32:00').getTime(),
            allowance: { resource: 'graphql', limit: 5000, remaining: 100, resetAt: new Date('2026-10-30T14:32:00') },
        },
        rateLimit: { resource: 'graphql', limit: 5000, remaining: 100, resetAt: new Date('2026-10-30T14:32:00') },
        lastRefreshedAt: new Date('2026-10-30T13:58:00').getTime(),
    },
};

/** K3 opened: reading and editing still work, other people's changes wait — the allowance, when it resumes, the last refresh. */
export const PausedExplained: Story = {
    args: Paused.args,
    play: async ({ canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: /Paused until/ }));
    },
};

/** The allowance used up to the last point, by other apps too: edits may be refused until the reset. */
export const Exhausted: Story = {
    args: {
        ...Paused.args,
        notice: {
            kind: 'paused',
            until: new Date('2026-10-30T14:32:00').getTime(),
            allowance: { resource: 'graphql', limit: 5000, remaining: 0, resetAt: new Date('2026-10-30T14:32:00') },
        },
    },
};

/** GitHub asked to slow down (`retry-after`) without the allowance running out. */
export const SlowedDown: Story = {
    args: {
        notice: { kind: 'paused', until: new Date('2026-10-30T14:32:00').getTime(), allowance: null },
        lastRefreshedAt: new Date('2026-10-30T13:58:00').getTime(),
    },
};

/** Paused under the rail: the icon alone, the sentence as its tooltip. */
export const PausedCollapsed: Story = { args: { ...Paused.args, collapsed: true } };
