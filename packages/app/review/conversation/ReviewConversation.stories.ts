import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';

import type { ItemComment, ItemReviewSummary, PullRequestDetail } from '@/store/ItemDetailTypes.js';
import { F1_PULL_REQUEST, F1_PULL_REQUEST_DETAIL } from '@/testing/sampleItemDetails.js';

import type { ReviewOwnThreads } from './getReviewOwnThreads.js';
import ReviewConversation from './ReviewConversation.vue';

const LONG_TEXT =
    '<p>Edits made offline go into an outbox table and are replayed in order when the connection returns.</p>';

const meta = {
    component: ReviewConversation,
    args: {
        item: F1_PULL_REQUEST,
        detail: { ...F1_PULL_REQUEST_DETAIL, bodyHtml: '<p>Second of four in the offline sync stack.</p>' },
        reviewThreads: new Map(),
        loadOlder: fn(() => Promise.resolve()),
        loadOlderReviews: fn(() => Promise.resolve()),
        onClose: fn(),
        onJumpToThreads: fn(),
    },
    render: args => ({
        components: { ReviewConversation },
        setup: () => ({ args }),
        template: `<div style="width: 340px; height: 500px"><ReviewConversation v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof ReviewConversation>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR2: summaries and comments in one time order under the description. */
export const Conversation: Story = {};

/** With a draft open the composer says it isn't one of the draft's: a comment here goes out at once (D17). */
export const ComposerWithDraftOpen: Story = {
    args: { draftOpen: true, onComment: fn() },
    play: async ({ args, canvas }) => {
        const field = canvas.getByPlaceholderText('Comments here go out now, not in your draft…');
        await userEvent.type(field, 'Thanks{Control>}{Enter}{/Control}');
        await userEvent.type(field, '{Meta>}{Enter}{/Meta}');
        await expect(args.onComment).toHaveBeenCalledWith('Thanks');
    },
};

/** Without the right to comment it can't be written in. */
export const ComposerDisabled: Story = {
    args: { commentDisabled: true },
    play: async ({ canvas }) => {
        await expect(canvas.getByPlaceholderText('Comment on the pull request…')).toHaveAttribute('readonly');
    },
};

/** The detail on its way: quietly, no spinner. */
export const Reading: Story = {
    args: { detail: null },
    play: async ({ canvas }) => {
        await expect(canvas.getByText('Reading the conversation…')).toBeVisible();
    },
};

/** Nothing said yet: says so quietly, with no count. */
export const Empty: Story = {
    args: { detail: quietDetail() },
    play: async ({ canvas }) => {
        await expect(canvas.getByText('No comments or reviews yet.')).toBeVisible();
    },
};

/** A long conversation opens at the newest, and stays there as what it holds grows late. */
export const OpensAtNewest: Story = {
    args: { detail: { ...quietDetail(), comments: commentsOf(20, null) } },
    play: async ({ canvasElement, canvas }) => {
        const scroller = getScroller(canvasElement);
        await waitFor(() => expect(isAtEnd(scroller)).toBe(true));
        await expect(canvas.getByText('Comment 20')).toBeVisible();

        const image = canvasElement.ownerDocument.createElement('div');
        image.style.height = '300px';
        canvas.getByText('Comment 20').append(image);
        await waitFor(() => expect(isAtEnd(scroller)).toBe(true));
    },
};

/** Scrolled away from the newest, growth at the end leaves the reader where they are. */
export const ScrolledAway: Story = {
    args: { detail: { ...quietDetail(), comments: commentsOf(20, null) } },
    play: async ({ canvasElement, canvas }) => {
        const scroller = getScroller(canvasElement);
        await waitFor(() => expect(isAtEnd(scroller)).toBe(true));
        scroller.scrollTop = 100;
        await waitFor(() => expect(scroller.scrollTop).toBe(100));

        const image = canvasElement.ownerDocument.createElement('div');
        image.style.height = '300px';
        canvas.getByText('Comment 20').append(image);
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        await expect(scroller.scrollTop).toBe(100);
    },
};

/** Comments not read yet: on asking they are read, and asking takes the reader nowhere. */
export const OlderComments: Story = {
    args: { detail: { ...quietDetail(), comments: commentsOf(2, 'C0', 52) } },
    play: async ({ args, canvas }) => {
        await userEvent.click(canvas.getByRole('button', { name: 'Show 50 older comments' }));
        await expect(args.loadOlder).toHaveBeenCalledTimes(1);
    },
};

/** CR2: the description folded until asked for. */
export const FoldedDescription: Story = {
    args: { detail: { ...quietDetail(), bodyHtml: LONG_TEXT.repeat(6) } },
    play: async ({ canvas, canvasElement }) => {
        const unfold = await canvas.findByRole('button', { name: 'Show the whole description' });
        const fold = canvasElement.querySelector('[class*="reviewConversation_fold"]');
        await expect(fold?.clientHeight).toBe(100);
        await userEvent.click(unfold);
        await waitFor(() => expect(fold?.clientHeight).toBeGreaterThan(100));
        await expect(canvas.queryByRole('button', { name: 'Show the whole description' })).toBeNull();
    },
};

/** A description that fits is not offered as folded. */
export const ShortDescription: Story = {
    play: async ({ canvas }) => {
        await expect(canvas.queryByRole('button', { name: 'Show the whole description' })).toBeNull();
    },
};

/** GitHub gives the newest 100 reviews at once: the others come on asking, not counted, for some of them say nothing. */
export const OlderReviews: Story = {
    args: {
        detail: {
            ...quietDetail(),
            reviewSummaries: [summary('PRR_1', 'APPROVED', '<p>Fine by me.</p>')],
            olderReviewCursor: 'older',
        },
    },
    play: async ({ canvas, args }) => {
        await userEvent.click(canvas.getByRole('button', { name: 'Show older reviews' }));
        await expect(args.loadOlderReviews).toHaveBeenCalledTimes(1);
        await expect(canvas.getByText('1')).toBeInTheDocument();
    },
};

/** CR2: what a review started: a click lands on them, and all of them resolved it says so. */
export const ReviewThreads: Story = {
    args: {
        detail: {
            ...quietDetail(),
            reviewSummaries: [
                summary('PRR_1', 'CHANGES_REQUESTED', '<p>Two things in the queue, see the threads.</p>'),
                summary('PRR_2', 'APPROVED', '<p>Fine by me.</p>'),
            ],
        },
        reviewThreads: new Map<string, ReviewOwnThreads>([
            ['PRR_1', { ids: new Set(['T_1', 'T_2']), resolved: false, paths: ['src/sync/queue.ts'] }],
            ['PRR_2', { ids: new Set(['T_3']), resolved: true, paths: ['src/sync/queue.ts'] }],
        ]),
    },
    play: async ({ args, canvas }) => {
        await expect(canvas.getByRole('button', { name: /^1.thread.in.files, resolved$/u })).toBeVisible();
        await userEvent.click(canvas.getByRole('button', { name: /^2.threads.in.files$/u }));
        await expect(args.onJumpToThreads).toHaveBeenCalledWith('PRR_1');
    },
};

/** Threads that show nowhere are said without a click. */
export const ThreadsNowhere: Story = {
    args: {
        detail: { ...quietDetail(), reviewSummaries: [summary('PRR_1', 'COMMENTED', '')] },
        reviewThreads: new Map<string, ReviewOwnThreads>([
            ['PRR_1', { ids: new Set(['T_1']), resolved: true, paths: [] }],
        ]),
    },
    play: async ({ canvas }) => {
        await expect(canvas.getByText('1 thread in files, resolved')).toBeVisible();
        await expect(canvas.queryByRole('button', { name: /^1.thread.in.files, resolved$/u })).toBeNull();
    },
};

/** Every verdict, one with no text and one dismissed. */
export const Verdicts: Story = {
    args: {
        detail: {
            ...quietDetail(),
            reviewSummaries: [
                summary('PRR_1', 'APPROVED', ''),
                summary('PRR_2', 'CHANGES_REQUESTED', LONG_TEXT),
                summary('PRR_3', 'COMMENTED', LONG_TEXT),
                summary('PRR_4', 'DISMISSED', ''),
            ],
        },
    },
};

function quietDetail(): PullRequestDetail {
    return {
        ...F1_PULL_REQUEST_DETAIL,
        bodyHtml: '',
        reviewSummaries: [],
        olderReviewCursor: null,
        comments: { totalCount: 0, nodes: [], olderCursor: null },
    };
}

function commentsOf(count: number, olderCursor: string | null, totalCount = count): PullRequestDetail['comments'] {
    const nodes = Array.from({ length: count }, (_, index): ItemComment => ({
        id: `C_${index + 1}`,
        url: 'https://github.com/fitloop/webapp/pull/1202#issuecomment-1',
        author: { login: 'sofiab', avatarUrl: '' },
        bodyHtml: `<p>Comment ${index + 1}</p>`,
        createdAt: new Date(Date.UTC(2026, 9, 30, 10, index)).toISOString(),
        lastEditedAt: null,
    }));
    return { totalCount, nodes, olderCursor };
}

function summary(id: string, state: ItemReviewSummary['state'], bodyHtml: string): ItemReviewSummary {
    return {
        id,
        url: `https://github.com/fitloop/webapp/pull/1202#pullrequestreview-${id}`,
        author: { login: 'sofiab', avatarUrl: '' },
        state,
        bodyHtml,
        submittedAt: '2026-10-30T12:00:00Z',
    };
}

function getScroller(root: HTMLElement) {
    const scroller = root.querySelector<HTMLElement>('[class*="reviewConversation_scroller"]');
    if (!scroller) {
        throw new Error('No scroller');
    }

    return scroller;
}

function isAtEnd(scroller: HTMLElement) {
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 2;
}
