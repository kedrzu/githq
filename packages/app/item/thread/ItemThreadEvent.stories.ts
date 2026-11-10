import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import type { ItemDetail, ThreadEvent } from '@/store/ItemDetailTypes.js';
import { D1_ISSUE_DETAIL } from '@/testing/sampleItemDetails.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import {
    EVERY_ISSUE_EVENT,
    EVERY_PULL_REQUEST_EVENT,
    F5_PULL_REQUEST,
    F5_PULL_REQUEST_DETAIL,
    I1_ISSUE,
    I1_ISSUE_DETAIL,
} from '@/testing/sampleThreadEvents.js';

import { buildThread } from './buildThread.js';
import type { ThreadChecksFailed, ThreadEventLine } from './buildThread.js';
import ItemThreadEvent from './ItemThreadEvent.vue';

/** The thread's width in a panel. */
const IN_PANEL = 512;

const meta = {
    component: ItemThreadEvent,
    args: { entry: linesOf(I1_ISSUE_DETAIL)[0]!, item: I1_ISSUE, now: SAMPLE_NOW, onOpen: fn() },
    // On an item view's background, as wide as the thread, with the rail behind the badges. `parameters.lines`: every
    // line of a thread, one under the other.
    render: (args, { parameters }) => ({
        components: { ItemThreadEvent },
        setup: () => ({ args, lines: parameters.lines ?? [args.entry] }),
        template: `
          <div style="position: relative; width: ${IN_PANEL}px; padding: 20px 0; background: #11161c">
            <div style="position: absolute; inset: 0 auto 0 55px; width: 2px; background: #2f353d" />
            <div style="position: relative">
              <ItemThreadEvent v-for="line in lines" :key="line.id" v-bind="args" :entry="line" />
            </div>
          </div>`,
    }),
} satisfies Meta<typeof ItemThreadEvent>;

export default meta;

type Story = StoryObj<typeof meta>;

/** F13, left: every event a pull request's thread shows, each on its own line. */
export const PullRequestEvents: Story = {
    args: { item: F5_PULL_REQUEST },
    parameters: { lines: linesOf(withEvents(F5_PULL_REQUEST_DETAIL, EVERY_PULL_REQUEST_EVENT)) },
};

/** F13, right: every event only an issue's thread shows. */
export const IssueEvents: Story = {
    parameters: { lines: linesOf(withEvents(I1_ISSUE_DETAIL, EVERY_ISSUE_EVENT)) },
};

/** F13's "one line per burst" and I1: "added bug and set the type to Bug", then the events of I1 one by one. */
export const IssueThread: Story = { parameters: { lines: linesOf(I1_ISSUE_DETAIL) } };

/** F5: "added storage and asked sofiab and dkim for a review", and the CI's failed checks, which name no one. */
export const PullRequestThread: Story = {
    args: { item: F5_PULL_REQUEST },
    parameters: { lines: linesOf(F5_PULL_REQUEST_DETAIL) },
};

/** Lines no person made: a project workflow's Status change and the CI's failed checks — no avatar, no one named. */
export const NoPerson: Story = {
    args: { item: F5_PULL_REQUEST },
    parameters: {
        lines: [
            ...linesOf(I1_ISSUE_DETAIL).filter(line => line.kind === 'events' && line.actor === null),
            ...linesOf(F5_PULL_REQUEST_DETAIL).filter(line => line.kind === 'checksFailed'),
        ],
    },
};

/** A thread's lines of events and failed checks, as `ItemThread` shows them. */
function linesOf(detail: ItemDetail): (ThreadEventLine | ThreadChecksFailed)[] {
    return buildThread({ detail }).filter(
        (entry): entry is ThreadEventLine | ThreadChecksFailed =>
            entry.kind === 'events' || entry.kind === 'checksFailed',
    );
}

function withEvents(detail: ItemDetail, newest: readonly ThreadEvent[]): ItemDetail {
    return {
        ...detail,
        comments: D1_ISSUE_DETAIL.comments,
        events: { totalCount: newest.length, commitCount: 0, oldest: [], newest, middle: null },
    };
}
