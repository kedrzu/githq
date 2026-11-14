import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { ChevronLeft, Plus, SlidersHorizontal } from 'lucide-vue-next';
import { defineComponent, h } from 'vue';

import IconButton from '@/components/IconButton.vue';
import type { SyncNotice } from '@/sync/SyncEngine.js';

import { PhoneShellContext } from './PhoneShellContext.js';
import PhoneTopBar from './PhoneTopBar.vue';

const meta = {
    component: PhoneTopBar,
    // As wide as a phone.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({ setup: () => () => h('div', { style: { width: '390px' } }, [h(Story)]) });
        },
    ],
} satisfies Meta<typeof PhoneTopBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The shell's own, on a screen that draws none (Settings): the places button alone. */
export const PlacesOnly: Story = {};

/** A list's (mobile MB32): the places button, the place's name, the list's options and New issue. */
export const List: Story = {
    args: { title: 'fitloop/webapp' },
    render: args => ({
        setup: () => () =>
            h(PhoneTopBar, args, {
                actions: () => [
                    h(IconButton, { icon: SlidersHorizontal, label: 'List options' }),
                    h(IconButton, { icon: Plus, label: 'New issue' }),
                ],
            }),
    }),
};

/** An item's page (mobile MB33): back in place of the places button. */
export const Back: Story = {
    render: () => ({
        setup: () => () => h(PhoneTopBar, null, { start: () => h(IconButton, { icon: ChevronLeft, label: 'Back' }) }),
    }),
};

/** Offline (mobile D12): the strip under the bar says so. */
export const Offline: Story = {
    args: { title: 'fitloop/webapp' },
    decorators: [withNotice({ kind: 'offline', since: new Date('2026-10-30T14:06:00').getTime() })],
};

/** Refresh paused (mobile D12, K3): the strip opens why. */
export const Paused: Story = {
    args: { title: 'fitloop/webapp' },
    decorators: [
        withNotice({
            kind: 'paused',
            until: new Date('2026-10-30T14:32:00').getTime(),
            allowance: { resource: 'graphql', limit: 5000, remaining: 100, resetAt: new Date('2026-10-30T14:32:00') },
        }),
    ],
};

function withNotice(notice: SyncNotice): Decorator {
    return story => {
        const Story = story();
        return defineComponent({
            setup: () => {
                provideContext(PhoneShellContext, {
                    notice,
                    lastRefreshedAt: new Date('2026-10-30T13:58:00').getTime(),
                });
                return () => h(Story);
            },
        });
    };
}
