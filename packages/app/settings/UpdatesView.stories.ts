import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import type { UpdateState } from '@/services/AppUpdate.js';

import UpdatesView from './UpdatesView.vue';

const NOW = Date.UTC(2026, 10, 4, 12);
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const STABLE: UpdateState = {
    version: '0.2.0',
    commit: '632d28b1f0a4',
    stream: 'stable',
    canChoose: true,
    manual: false,
    checkedAt: NOW - 2 * HOUR,
    activity: { kind: 'upToDate' },
};

const DEVELOPMENT: UpdateState = {
    ...STABLE,
    version: '0.3.0-dev.214',
    stream: 'development',
    checkedAt: NOW - 6 * MINUTE,
};

/** A Development build that has just been switched to Stable. */
const LEAVING: UpdateState = { ...DEVELOPMENT, stream: 'stable', manual: true };

const meta = {
    component: UpdatesView,
    args: {
        state: STABLE,
        now: NOW,
        onCheck: fn(),
        onRestart: fn(),
        onSetStream: fn(),
    },
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof UpdatesView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** U3: a Stable version at rest. */
export const StableVersion: Story = {};

/** U4: a Development build at rest. */
export const DevelopmentBuild: Story = { args: { state: DEVELOPMENT } };

/** A local build knows no commit. */
export const NoCommit: Story = { args: { state: { ...DEVELOPMENT, commit: null } } };

/** Before the first check of this run. */
export const NothingCheckedYet: Story = { args: { state: { ...STABLE, checkedAt: null, activity: { kind: 'idle' } } } };

/** U5: checking. */
export const Checking: Story = { args: { state: { ...STABLE, activity: { kind: 'checking' } } } };

/** U6: up to date, just now. */
export const UpToDate: Story = { args: { state: { ...STABLE, checkedAt: NOW - 5000 } } };

/** U7: found one, downloading. */
export const Downloading: Story = {
    args: { state: { ...STABLE, activity: { kind: 'downloading', version: '0.2.1', percent: 38 } } },
};

/** The server doesn't say how long the download is. */
export const DownloadingNoLength: Story = {
    args: { state: { ...STABLE, activity: { kind: 'downloading', version: '0.2.1', percent: null } } },
};

/** U8: ready to restart. */
export const Ready: Story = { args: { state: { ...STABLE, activity: { kind: 'ready', version: '0.2.1' } } } };

/** U9: failed, offline. */
export const FailedOffline: Story = {
    args: { state: { ...STABLE, activity: { kind: 'failed', reason: 'offline' } } },
};

/** U10: failed, GitHub out of reach. */
export const FailedUnreachable: Story = {
    args: { state: { ...STABLE, activity: { kind: 'failed', reason: 'unreachable' } } },
};

/** U11: a build before the first Stable, following Stable, at a later check. */
export const NoStableYet: Story = {
    args: { state: { ...LEAVING, version: '0.1.0-dev.187', manual: false, activity: { kind: 'noRelease' } } },
};

/** Development can read the same, for the seconds a build replaces the last. */
export const NoDevelopmentBuildYet: Story = {
    args: { state: { ...DEVELOPMENT, activity: { kind: 'noRelease' } } },
};

/** U12: Windows has no choice of stream. */
export const Windows: Story = { args: { state: { ...STABLE, canChoose: false } } };

/** U13: the confirmation open, over U4. */
export const ConfirmSwitch: Story = { args: { state: DEVELOPMENT, confirming: true } };

/** U14: to Stable, downloading. */
export const ToStableDownloading: Story = {
    args: { state: { ...LEAVING, activity: { kind: 'downloading', version: '0.2.0', percent: 62 } } },
};

/** U15: to Stable, ready. */
export const ToStableReady: Story = { args: { state: { ...LEAVING, activity: { kind: 'ready', version: '0.2.0' } } } };

/** A Development build was ready when the user switched: it is nothing out of the ordinary until Stable replaces it. */
export const DevelopmentReadyOnStable: Story = {
    args: { state: { ...LEAVING, activity: { kind: 'ready', version: '0.3.0-dev.215' } } },
};

/** U16: to Stable, offline. */
export const ToStableOffline: Story = {
    args: { state: { ...LEAVING, activity: { kind: 'failed', reason: 'offline' } } },
};

/** To Stable, GitHub out of reach: U16 with U10's reason. */
export const ToStableUnreachable: Story = {
    args: { state: { ...LEAVING, activity: { kind: 'failed', reason: 'unreachable' } } },
};

/** U17: to Stable, with no Stable yet. */
export const ToStableNoRelease: Story = {
    args: { state: { ...LEAVING, version: '0.1.0-dev.187', activity: { kind: 'noRelease' } } },
};

/** U18: to Development, nothing newer yet. */
export const ToDevelopmentNothingNewer: Story = {
    args: { state: { ...STABLE, stream: 'development', manual: true } },
};

/** U40 in Settings: installing, nothing on offer. */
export const Installing: Story = { args: { state: { ...STABLE, activity: { kind: 'installing', version: '0.2.1' } } } };

/** U39's place: a failed install, with the wording that holds for any failure. */
export const InstallFailed: Story = {
    args: { state: { ...STABLE, activity: { kind: 'installFailed', version: '0.2.1' } } },
};
