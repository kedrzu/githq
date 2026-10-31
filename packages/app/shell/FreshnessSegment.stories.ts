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

/** Offline: amber, as of the last success. */
export const Offline: Story = { args: { freshness: { kind: 'stale', since: AT_14_06, reason: 'offline' } } };

/** GitHub failing: amber, retried every interval. */
export const Failing: Story = { args: { freshness: { kind: 'stale', since: AT_14_06, reason: 'failing' } } };

/** GitHub refusing a repository's changes (a 403): amber, asked again hourly. */
export const Refused: Story = { args: { freshness: { kind: 'stale', since: AT_14_06, reason: 'refused' } } };

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
