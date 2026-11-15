import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ChevronLeft } from 'lucide-vue-next';
import { fn, userEvent, within } from 'storybook/test';
import { h } from 'vue';

import IconButton from '@/components/IconButton.vue';
import { SAMPLE_MY_WORK_COUNTS, SAMPLE_TRACKED } from '@/testing/samplePlaces.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import AppShell from './AppShell.vue';
import PhoneCommandLine from './PhoneCommandLine.vue';
import PhoneTopBar from './PhoneTopBar.vue';

const CHECKED_AT = new Date('2026-10-30T14:06:00').getTime();

const meta = {
    component: AppShell,
    args: {
        viewer: SAMPLE_VIEWER,
        rateLimit: { resource: 'graphql', limit: 5000, remaining: 4812, resetAt: new Date('2026-10-30T15:00:00Z') },
        notice: null,
        freshness: { kind: 'fresh', checkedAt: CHECKED_AT },
        myWorkCounts: SAMPLE_MY_WORK_COUNTS,
        tracked: SAMPLE_TRACKED,
        phone: true,
        onSignOut: fn(),
        onSearch: fn(),
        onShowFailure: fn(),
        'onUpdate:panelFits': fn(),
    },
    render: args => ({
        setup: () => () =>
            h(AppShell, args, {
                default: () => screen(),
                commandLine: () => h(PhoneCommandLine, { variant: 'list', part: { label: 'Issues', count: 142 } }),
            }),
    }),
} satisfies Meta<typeof AppShell>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * On a phone, a screen with no top bar of its own (Settings): the shell's, with the places button; the screen the
 * window's width, no sidebar nor status bar; the command line floating over its bottom, the list scrolling under it to
 * its last row above it (mobile MB32).
 */
export const Phone: Story = {};

/** On a phone, offline (mobile D12): the strip under the top bar says so. */
export const PhoneOffline: Story = { args: { notice: { kind: 'offline', since: CHECKED_AT } } };

/** On a phone, the places panel opened from the top bar (mobile MB26). */
export const PhonePlacesOpen: Story = {
    play: async ({ canvasElement }) => {
        await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open places' }));
    },
};

/** On a phone, an item's page, which draws its own top bar (back); the command line the comment box's and ⌘ (mobile MB33). */
export const PhoneItemPage: Story = {
    args: { ownTopBar: true },
    render: args => ({
        setup: () => () =>
            h(AppShell, args, {
                default: () => [
                    h(PhoneTopBar, null, {
                        start: () => h(IconButton, { icon: ChevronLeft, label: 'Back to Issues' }),
                    }),
                    screen(),
                ],
                commandLine: () => h(PhoneCommandLine, { variant: 'item' }),
            }),
    }),
};

/** On a computer: the sidebar, the screen and the status bar, as they always were. */
export const Desktop: Story = { args: { phone: false } };

/** A screen scrolling in a container of its own, as the app's do (`data-route-scroll`). */
function screen() {
    return h(
        'div',
        {
            'data-route-scroll': 'story',
            role: 'group',
            tabindex: 0,
            'aria-label': 'Issues',
            style: { flex: '1', minHeight: '0', overflowY: 'auto' },
        },
        Array.from({ length: 30 }, (_, index) =>
            h('p', { style: { margin: '0', padding: '12px 16px' } }, `Issue ${index + 1}`),
        ),
    );
}
