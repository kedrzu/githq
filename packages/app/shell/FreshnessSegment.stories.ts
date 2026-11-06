import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import FreshnessSegment from './FreshnessSegment.vue';

const AT_14_06 = new Date('2026-10-30T14:06:00').getTime();

const meta = {
    component: FreshnessSegment,
    args: { freshness: { kind: 'fresh', checkedAt: AT_14_06 } },
    // In a bar as tall as the status bar.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () => h('div', { style: { display: 'flex', height: '26px', width: '560px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof FreshnessSegment>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Most of the time: dim "Up to date". */
export const Fresh: Story = {};

/** On a screen of Settings, saving on: where the settings are saved (githq D26). */
export const SettingsSaved: Story = {
    args: {
        freshness: { kind: 'settingsSaved', checkedAt: AT_14_06, saving: 'on', repository: 'mlaine/githq-settings' },
    },
};

/** On a screen of Settings, saving off: they stay on this device. */
export const SettingsSavingOff: Story = {
    args: {
        freshness: { kind: 'settingsSaved', checkedAt: AT_14_06, saving: 'off', repository: 'mlaine/githq-settings' },
    },
};

/** On a screen of Settings, syncing stopped: they stay on this device until it is fixed. */
export const SettingsSyncStopped: Story = {
    args: {
        freshness: {
            kind: 'settingsSaved',
            checkedAt: AT_14_06,
            saving: 'stopped',
            repository: 'mlaine/githq-settings',
        },
    },
};

/** A check running after the last one went out of date. */
export const Checking: Story = { args: { freshness: { kind: 'checking', since: AT_14_06 } } };

/** The first download: grey, nothing is wrong. */
export const Partial: Story = { args: { freshness: { kind: 'partial' } } };

/** My work's first download, no search answered yet (first run and loading D14, G16). */
export const FetchingMyWork: Story = {
    args: { freshness: { kind: 'partial', arriving: ['reviewRequested', 'authored', 'assigned', 'mentioned'] } },
};

/** My work's first download, two groups in: the others named (D14, G17). */
export const MyWorkArriving: Story = { args: { freshness: { kind: 'partial', arriving: ['assigned', 'mentioned'] } } };

/** A tracked repository before its open issues are in (first run and loading D14, ES14). */
export const DownloadingOpenIssues: Story = {
    args: { freshness: { kind: 'partial', downloading: { phase: 'openIssues', done: 40, total: 142 } } },
};

/** A tracked repository whose closed issues still arrive: not "Up to date" yet (D3, ES9). */
export const DownloadingClosedIssues: Story = {
    args: { freshness: { kind: 'partial', downloading: { phase: 'closedIssues', done: 1200, total: 4000 } } },
};

/** A tracked project while its items download (first run and loading D14, ES18). */
export const DownloadingItems: Story = {
    args: { freshness: { kind: 'partial', downloading: { phase: 'items', done: 0, total: 128 } } },
};

/** A commit graph's first read: GitHub gives no cheap count of commits (first run and loading D14, ES21). */
export const ReadingCommits: Story = { args: { freshness: { kind: 'partial', readingCommits: true } } };

/** Files of a review selected together: the keys that act on them (CR23). */
export const FilesSelected: Story = { args: { freshness: { kind: 'filesSelected' } } };

/** On a thread of a review: which of them it is, and the keys that walk them (CR15). */
export const ThreadPosition: Story = {
    args: { freshness: { kind: 'threadPosition', position: 2, total: 7, open: 5 } },
};

/** A review opened for the first time, on its first file not viewed (CR20). */
export const LandedFirstFile: Story = {
    args: { freshness: { kind: 'landing', at: 'firstFile', number: 1202, viewed: 9, total: 42, backTo: null } },
};

/** The same, walked to with `J` (CR25). */
export const LandedFirstFileWalked: Story = {
    args: {
        freshness: {
            kind: 'landing',
            at: 'firstFile',
            number: 1203,
            viewed: 0,
            total: 42,
            backTo: { key: 'K', number: 1202 },
        },
    },
};

/** Come back to where it was left (CR26). */
export const LandedLeft: Story = {
    args: { freshness: { kind: 'landing', at: 'left', number: 1202, file: 'engine.ts', line: 47 } },
};

/** GitHub didn't give a review's threads: the files stay usable, and it says so. */
export const ThreadsUnread: Story = { args: { freshness: { kind: 'threadsUnread' } } };

/** A review's threads wait for the allowance. */
export const ThreadsPaused: Story = { args: { freshness: { kind: 'threadsPaused', until: AT_14_06 } } };

/** A repository's workflows listed, the first read of their runs under way (actions W3c). */
export const ReadingRuns: Story = { args: { freshness: { kind: 'reading', read: 2, total: 6 } } };

/** A run's page is waiting for a log (actions W4e). */
export const ReadingLog: Story = { args: { freshness: { kind: 'readingLog', job: 'build' } } };
/** A first open's other branches arriving (git-client D19). */
export const FillingIn: Story = { args: { freshness: { kind: 'filling', done: 3, total: 7 } } };

/** Offline: amber, as of the last success. */
export const Offline: Story = { args: { freshness: { kind: 'stale', since: AT_14_06, reason: 'offline' } } };

/** GitHub failing: amber, retried every interval. */
export const Failing: Story = { args: { freshness: { kind: 'stale', since: AT_14_06, reason: 'failing' } } };

/** GitHub refusing a repository's changes (a 403): amber, asked again hourly. */
export const Refused: Story = { args: { freshness: { kind: 'stale', since: AT_14_06, reason: 'refused' } } };

/** W3e: GitHub no longer lists a repository's workflows; the rows below are the last known ones. */
export const WorkflowsUnavailable: Story = {
    args: { freshness: { kind: 'stale', since: null, reason: 'workflowsUnavailable' } },
};

/** Refresh paused by the allowance: since when the list has not been refreshed. */
export const Paused: Story = {
    args: { freshness: { kind: 'paused', since: AT_14_06, until: new Date('2026-10-30T15:00:00').getTime() } },
};

/** K3, the screen's segment: paused, and the user's edits still go through. */
export const PausedWithEditsHint: Story = { args: { ...Paused.args, editsHint: true } };

/** K6: a saved view githq can't evaluate, answered by GitHub — purple, expected, and why it is slower. */
export const AnsweredByGitHub: Story = {
    args: { freshness: { kind: 'answered', term: 'no:linked-pull-requests', checkedAt: AT_14_06 } },
};

/** PM35: a merge GitHub refused after the user moved on — red, as any failed edit (K1), until dismissed. */
export const MergeRefused: Story = {
    args: { edits: { kind: 'failed', text: 'Merge refused · fitloop/api#477' } },
};

/** PM36: a merge GitHub has not said the end of — grey, neither failed nor done, until the next refresh. */
export const MergeUnanswered: Story = {
    args: {
        edits: {
            kind: 'unanswered',
            text: "fitloop/api#477 · GitHub hasn't answered · the next refresh will settle it",
        },
    },
};
