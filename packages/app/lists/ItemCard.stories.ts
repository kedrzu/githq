import { provideContext } from '@nzyme/vue-utils/context.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';
import { defineComponent, h } from 'vue';

import { MergeContext } from '@/merge/MergeContext.js';
import type { MergeRecord, SentMerge } from '@/merge/MergeTypes.js';
import { D1_ITEMS, SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_STACKS, sampleListStack } from '@/testing/sampleStacks.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import ItemCard from './ItemCard.vue';
import { ITEM_PROPERTIES } from './ItemProperty.js';

const [LONE] = SAMPLE_STACKS.needsRebase;
if (!LONE) {
    throw new Error('The sample stack needs pull requests.');
}

const ISSUE = D1_ITEMS.find(item => item.kind === 'issue');
const SIZED = D1_ITEMS.find(item => item.kind === 'pullRequest' && item.id === 'PR_1203');
if (!ISSUE || !SIZED) {
    throw new Error('The sample items need an issue and a pull request.');
}

/** Approved and ready to merge: what a merge refused or unanswered reads over. */
const READY = D1_ITEMS.find(item => item.id === 'PR_477');
if (READY?.kind !== 'pullRequest') {
    throw new Error('The sample work needs the pull request PR_477.');
}

/** A merge sent from the panel, with GitHub's text, naming the head the card shows. */
const SENT: SentMerge = { request: { method: 'SQUASH' }, edited: null, head: READY.headRefOid };
/** When GitHub answered it. */
const AT = SAMPLE_NOW;

/** Under a screen that knows how the card's last merge ended (merging D15). */
function withMergeRecord(record: MergeRecord): Decorator {
    return story =>
        defineComponent({
            setup() {
                provideContext(MergeContext, {
                    canOpen: () => true,
                    open: () => undefined,
                    getRecord: () => record,
                    getCommands: () => [],
                    run: () => undefined,
                });
                return () => h(story());
            },
        });
}

const meta = {
    component: ItemCard,
    args: {
        item: LONE,
        properties: ITEM_PROPERTIES,
        now: SAMPLE_NOW,
        viewerLogin: SAMPLE_VIEWER.login,
        people: 'assignees',
    },
    // As wide as a board's column, in a card as the board draws it.
    render: args => ({
        components: { ItemCard },
        setup: () => ({ args }),
        template: `<div style="width: 268px; background: #1a1d22; border: 1px solid #22262d; border-radius: 8px">
            <ItemCard v-bind="args" />
        </div>`,
    }),
} satisfies Meta<typeof ItemCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** SP27's second card, SP26's mobile#94: a pull request alone in its column, an ordinary card with the marker "1 of 3". */
export const LoneCard: Story = {
    args: { stack: sampleListStack(SAMPLE_STACKS.needsRebase).description },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByLabelText('In a stack')).toBeVisible();
        await expect(canvas.getByText('1 of 3')).toBeVisible();
    },
};

/** A pull request shows its size, nested under an issue too; "Size" off in Display hides it. */
export const Size: Story = {
    args: { item: SIZED, parent: ISSUE },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByText('+1,092')).toBeVisible();
        await expect(canvas.getByText('−640')).toBeVisible();
    },
};

export const SizeOff: Story = {
    args: { item: SIZED, properties: ITEM_PROPERTIES.filter(property => property !== 'size') },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).queryByText('+1,092')).toBeNull();
    },
};

/** An issue has no lines to count. */
export const IssueHasNoSize: Story = {
    args: { item: ISSUE },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).queryByText(/^−\d/)).toBeNull();
    },
};

/** PM37 on a board: a merge GitHub refused after the user moved on — the same line as the row's. */
export const MergeRefused: Story = {
    args: { item: READY },
    decorators: [
        withMergeRecord({
            kind: 'refused',
            sent: SENT,
            reason: { kind: 'refused', message: 'Rule violations.' },
            at: AT,
        }),
    ],
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('Merge refused')).toBeVisible();
    },
};

/** PM37 on a board: refused for a commit pushed meanwhile — the card's head is no longer the one the merge named. */
export const MergeNewCommit: Story = {
    args: { item: { ...READY, headRefOid: 'new-head' } },
    decorators: [
        withMergeRecord({ kind: 'refused', sent: SENT, reason: { kind: 'refused', message: 'Modified.' }, at: AT }),
    ],
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('Not merged · new commit')).toBeVisible();
    },
};

/** PM36, PM37 on a board: no answer in time — grey, neither merged nor refused. */
export const MergeOutcomeUnknown: Story = {
    args: { item: READY },
    decorators: [withMergeRecord({ kind: 'unknown', sent: SENT, at: AT, accepted: true })],
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('Merge sent · outcome not known yet')).toBeVisible();
    },
};

/** PM37 on a board: in a merge queue, the same line as the row's. */
export const InMergeQueue: Story = {
    args: {
        item: {
            ...READY,
            mergeQueueEntry: {
                position: 3,
                state: 'AWAITING_CHECKS',
                estimatedTimeToMerge: 12 * 60,
                enqueuedAt: '2026-11-03T00:00:00Z',
                enqueuer: 'mlaine',
            },
        },
    },
};

/** PM37 on a board: under auto-merge, the same line as the row's. */
export const AutoMergeOn: Story = {
    args: {
        item: {
            ...READY,
            autoMerge: { mergeMethod: 'SQUASH', enabledAt: null, enabledBy: 'mlaine', commitHeadline: null },
        },
    },
};
