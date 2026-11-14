import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import SyncSegment from './SyncSegment.vue';

const ALLOWANCE = {
    resource: 'graphql',
    limit: 5000,
    remaining: 4812,
    resetAt: new Date('2026-10-30T15:00:00Z'),
} as const;
const OFFLINE = { kind: 'offline', since: new Date('2026-10-30T14:06:00').getTime() } as const;
const PAUSED = {
    kind: 'paused',
    until: new Date('2026-10-30T14:32:00').getTime(),
    allowance: { resource: 'graphql', limit: 5000, remaining: 100, resetAt: new Date('2026-10-30T14:32:00') },
} as const;

const meta = {
    component: SyncSegment,
    args: { rateLimit: ALLOWANCE },
    // As wide as a phone, as the strip and the places panel's foot are; the status bar's own are `StatusBar`'s stories.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () =>
                    h('div', { style: { display: 'flex', alignItems: 'center', minHeight: '26px', width: '390px' } }, [
                        h(Story),
                    ]),
            });
        },
    ],
} satisfies Meta<typeof SyncSegment>;

export default meta;

type Story = StoryObj<typeof meta>;

/** At the places panel's foot (mobile MB26): the allowance, as wide as it says. */
export const Inline: Story = { args: { placement: 'inline' } };

/** At the places panel's foot, while the download of everything tracked lasts (mobile D31). */
export const InlineDownloading: Story = {
    args: {
        placement: 'inline',
        download: { done: 1240, total: 8000, secondsLeft: 120, repositories: 3, projects: 1 },
    },
};

/** Under the phone's top bar, offline (mobile D12): the whole width, in amber. */
export const StripOffline: Story = { args: { placement: 'strip', rateLimit: null, notice: OFFLINE } };

/** Under the phone's top bar, refresh paused (mobile D12, K3): a button opening why. */
export const StripPaused: Story = {
    args: {
        placement: 'strip',
        rateLimit: null,
        notice: PAUSED,
        lastRefreshedAt: new Date('2026-10-30T13:58:00').getTime(),
    },
};
