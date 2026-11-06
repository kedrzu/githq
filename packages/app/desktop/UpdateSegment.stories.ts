import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Check } from 'lucide-vue-next';
import { fn } from 'storybook/test';
import { h } from 'vue';

import StatusBar from '@/shell/StatusBar.vue';
import StatusSegment from '@/shell/StatusSegment.vue';

import UpdateSegment from './UpdateSegment.vue';

const meta = {
    component: UpdateSegment,
    args: {
        notice: { kind: 'ready', version: '1.4.0' },
        onRestart: fn(),
        onCheck: fn(),
        onDismiss: fn(),
    },
    // At the right end of the status bar, after the last surface's segment — where the desktop app's `StatusBar`
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

/** U50: an update downloaded and waiting, its toast dismissed: a quiet trace with Restart. */
export const Ready: Story = {};

/** U21: a check the user asked for, under way. */
export const Checking: Story = { args: { notice: { kind: 'checking' } } };

/** U22: nothing newer; goes away by itself. */
export const UpToDate: Story = { args: { notice: { kind: 'upToDate', version: '1.3.0' } } };

/** U22: found, downloading. */
export const Downloading: Story = { args: { notice: { kind: 'downloading', version: '1.4.0', percent: 38 } } };

/** The server doesn't say how long the download is. */
export const DownloadingNoPercent: Story = {
    args: { notice: { kind: 'downloading', version: '1.4.0', percent: null } },
};

/** U22: the check failed, the user offline. */
export const FailedOffline: Story = { args: { notice: { kind: 'failed', reason: 'offline' } } };

/** U22: the check failed, GitHub out of reach. */
export const FailedUnreachable: Story = { args: { notice: { kind: 'failed', reason: 'unreachable' } } };

/** U22: nothing failed, the stream has no release. */
export const NoRelease: Story = { args: { notice: { kind: 'noRelease', stream: 'stable' } } };

/** No release, on Development. */
export const NoDevelopmentBuild: Story = { args: { notice: { kind: 'noRelease', stream: 'development' } } };

/** U40: installing, the system perhaps asking for a password; offers nothing. */
export const Installing: Story = { args: { notice: { kind: 'installing', version: '1.4.0' } } };

/**
 * U51: the install failed or the password was refused, which can't be told apart; its toast dismissed, Try again is
 * left.
 */
export const InstallFailed: Story = { args: { notice: { kind: 'installFailed', version: '1.4.0' } } };
