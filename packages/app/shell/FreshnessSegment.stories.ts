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

/** A check running after the last one went out of date. */
export const Checking: Story = { args: { freshness: { kind: 'checking', since: AT_14_06 } } };

/** The first download: grey, nothing is wrong. */
export const Partial: Story = { args: { freshness: { kind: 'partial' } } };

/** Files of a review selected together: the keys that act on them (CR23). */
export const FilesSelected: Story = { args: { freshness: { kind: 'filesSelected' } } };

/** On a thread of a review: which of them it is, and the keys that walk them (CR15). */
export const ThreadPosition: Story = {
    args: { freshness: { kind: 'threadPosition', position: 2, total: 7, open: 5 } },
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
