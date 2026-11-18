import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import type { ItemDetail, ThreadEvent } from '@/store/ItemDetailTypes.js';
import { D1_ISSUE_DETAIL } from '@/testing/sampleItemDetails.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import {
    BURST_OF_ONE_KIND,
    EVERY_ISSUE_EVENT,
    EVERY_PULL_REQUEST_EVENT,
    F5_PULL_REQUEST,
    F5_PULL_REQUEST_DETAIL,
    I1_ISSUE,
    I1_ISSUE_DETAIL,
    THEIR_OWN_REVIEW_REQUEST,
} from '@/testing/sampleThreadEvents.js';
import { withPhoneLayout } from '@/testing/withPhoneLayout.js';
import { withReadingCursor } from '@/testing/withReadingCursor.js';

import { buildThread } from './buildThread.js';
import type { ThreadChecksFailed, ThreadEventLine } from './buildThread.js';
import ItemThreadEvent from './ItemThreadEvent.vue';

/** The thread's width in a panel. */
const IN_PANEL = 512;
/** The widest the thread stretches: the one-column panel at its widest. */
const WIDEST = 1300;

const meta = {
    component: ItemThreadEvent,
    args: { entry: linesOf(I1_ISSUE_DETAIL)[0]!, item: I1_ISSUE, now: SAMPLE_NOW, onOpen: fn() },
    // On an item view's background, as wide as the thread, with the rail behind the badges. `parameters.lines`: every
    // line of a thread, one under the other; `parameters.width` instead of the panel's.
    render: (args, { parameters }) => ({
        components: { ItemThreadEvent },
        setup: () => ({ args, lines: parameters.lines ?? [args.entry], width: parameters.width ?? IN_PANEL }),
        template: `
          <div :style="{ position: 'relative', width: width + 'px', padding: '20px 0', background: '#11161c' }" tid="frame">
            <div style="position: absolute; inset: 0 auto 0 55px; width: 2px; background: #2f353d" />
            <div style="position: relative">
              <ItemThreadEvent v-for="line in lines" :key="line.id" v-bind="args" :entry="line" />
            </div>
          </div>`,
    }),
    // The desktop's, whatever the width; a phone's story says so.
    decorators: [withPhoneLayout(false)],
} satisfies Meta<typeof ItemThreadEvent>;

export default meta;

type Story = StoryObj<typeof meta>;

/** F13, left: every event a pull request's thread shows, each on its own line. */
export const PullRequestEvents: Story = {
    args: { item: F5_PULL_REQUEST },
    parameters: { lines: linesOf(withEvents(F5_PULL_REQUEST_DETAIL, EVERY_PULL_REQUEST_EVENT), true) },
};

/** The person asking for their own review and taking it back: said of themselves, not by their login. */
export const TheirOwnReviewRequest: Story = {
    args: { item: F5_PULL_REQUEST },
    parameters: { lines: linesOf(withEvents(F5_PULL_REQUEST_DETAIL, THEIR_OWN_REVIEW_REQUEST), true) },
};

/** F13, right: every event only an issue's thread shows. */
export const IssueEvents: Story = {
    parameters: { lines: linesOf(withEvents(I1_ISSUE_DETAIL, EVERY_ISSUE_EVENT), true) },
};

/** F13's "events of one kind merge their objects": more than one by their references alone, in one line. */
export const OneKindMerged: Story = {
    parameters: { lines: linesOf(withEvents(I1_ISSUE_DETAIL, BURST_OF_ONE_KIND)) },
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

/** A thread's lines of events and failed checks, as `ItemThread` shows them; `unfolded`, all of them. */
function linesOf(detail: ItemDetail, unfolded = false): (ThreadEventLine | ThreadChecksFailed)[] {
    return buildThread({ detail, unfolded }).filter(
        (entry): entry is ThreadEventLine | ThreadChecksFailed =>
            entry.kind === 'events' || entry.kind === 'checksFailed',
    );
}

/** The detail with these events, and comments held whole: nothing unread folds them away. */
function withEvents(detail: ItemDetail, newest: readonly ThreadEvent[]): ItemDetail {
    return {
        ...detail,
        comments: { ...D1_ISSUE_DETAIL.comments, olderCursor: null },
        events: { totalCount: newest.length, commitCount: 0, oldest: [], newest, middle: null },
    };
}

/** The thread at its widest: the time follows what was done, it is not pushed to the far edge. */
export const Wide: Story = { parameters: { width: WIDEST } };

/** `Activity / Event · current`: the reading cursor on the line, tinted with rounded corners. */
export const Current: Story = { decorators: [withReadingCursor(`events:${linesOf(I1_ISSUE_DETAIL)[0]!.id}`)] };
