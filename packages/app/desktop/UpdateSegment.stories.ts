import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Check } from 'lucide-vue-next';
import { fn } from 'storybook/test';
import { h } from 'vue';

import StatusBar from '@/shell/StatusBar.vue';
import StatusSegment from '@/shell/StatusSegment.vue';

import UpdateSegment from './UpdateSegment.vue';

const meta = {
    component: UpdateSegment,
    args: { version: '1.4.0', onRestart: fn(), onLater: fn() },
    // U1: at the right end of the status bar, after the last surface's segment — where the desktop app's `StatusBar`
    // puts it (the stories show the web app, which never does).
    render: args => ({
        setup: () => () =>
            h(
                StatusBar,
                {
                    rateLimit: {
                        resource: 'graphql',
                        limit: 5000,
                        remaining: 4812,
                        resetAt: new Date('2026-10-30T15:00:00Z'),
                    },
                },
                { default: () => [h(StatusSegment, { icon: Check }, () => 'Up to date'), h(UpdateSegment, args)] },
            ),
    }),
} satisfies Meta<typeof UpdateSegment>;

export default meta;

type Story = StoryObj<typeof meta>;

/** U1: an update downloaded and waiting — "githq 1.4.0 is ready", Restart, Later. */
export const Ready: Story = {};
