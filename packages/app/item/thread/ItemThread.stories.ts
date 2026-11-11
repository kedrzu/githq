import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { FailedComment, FailedTextEdit } from '@/edits/CommentDrafts.js';
import type { IssueDetail, ItemComment } from '@/store/ItemDetailTypes.js';
import { FakeReviewWriting } from '@/testing/FakeReviewWriting.js';
import { D1_ISSUE, D1_ISSUE_DETAIL, F1_PULL_REQUEST, F1_PULL_REQUEST_DETAIL } from '@/testing/sampleItemDetails.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { CHANGES_REQUESTED_REVIEW, DB_THREAD, REVIEW_VIEWER, SCHEMA_THREAD } from '@/testing/sampleReviews.js';
import {
    F5_PULL_REQUEST,
    F5_PULL_REQUEST_DETAIL,
    I1_ISSUE,
    I1_ISSUE_DETAIL,
    I2_ISSUE,
    I2_ISSUE_DETAIL,
    THREAD_VIEWER,
} from '@/testing/sampleThreadEvents.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import ItemThread from './ItemThread.vue';
import ItemThreadComposer from './ItemThreadComposer.vue';

/** The main column's content in a panel; a page's is `ON_PAGE`. */
const IN_PANEL = 512;
/** The reading width a page keeps its main column to. */
const ON_PAGE = { width: 760 };
const HOUR = 60 * 60_000;
const MINUTE = 60_000;

/** The user's comments GitHub did not take: one while offline, one refused. */
const FAILED_COMMENTS: FailedComment[] = [
    {
        id: 1,
        itemId: F1_PULL_REQUEST.id,
        body: 'Thanks both. The cross-repository case is fixed in 3f2a9b1 and the e2e is green again.',
        reason: { kind: 'offline' },
        retrying: false,
    },
    {
        id: 2,
        itemId: F1_PULL_REQUEST.id,
        body: '@sofiab could you take another look?',
        reason: { kind: 'refused', message: 'Commenting is disabled.' },
        retrying: false,
    },
];

const meta = {
    component: ItemThread,
    args: {
        item: D1_ISSUE,
        detail: D1_ISSUE_DETAIL,
        now: SAMPLE_NOW,
        loadMiddle: fn(() => Promise.resolve()),
        canQuote: true,
    },
    // On an item view's background, as wide as its main column (`parameters.width`), ending in the composer — the
    // thread's viewer's, else the sample viewer's.
    render: (args, { parameters }) => ({
        components: { ItemThread, ItemThreadComposer },
        setup: () => ({
            args,
            viewer: args.viewer ?? { login: SAMPLE_VIEWER.login, avatarUrl: SAMPLE_VIEWER.avatarUrl },
        }),
        template: `
          <div style="width: ${parameters.width ?? IN_PANEL}px; padding: 20px 0; background: #11161c">
            <ItemThread v-bind="args">
              <template #composer>
                <ItemThreadComposer :item="args.item" :viewer="viewer" can-comment can-close :read-only="null" />
              </template>
            </ItemThread>
          </div>`,
    }),
} satisfies Meta<typeof ItemThread>;

export default meta;

type Story = StoryObj<typeof meta>;

/** F9-like, for an issue in the side panel: the description, the fold over the two comments not read yet on two lines, the two read. */
export const IssueInPanel: Story = {};

/** I1: the same issue on a page; the fold on one line. */
export const IssueOnPage: Story = { parameters: ON_PAGE };

/** A pull request in the side panel: every comment read, no fold. */
export const PullRequestInPanel: Story = { args: { item: F1_PULL_REQUEST, detail: F1_PULL_REQUEST_DETAIL } };

/** F5: the same pull request on a page. */
export const PullRequestOnPage: Story = { args: PullRequestInPanel.args, parameters: ON_PAGE };

/**
 * I1 on a page: the issue's events and comments in one time order, one person's events in a burst on one line; mlaine
 * last looked at it four hours ago and pinned it since, so "1 new since you looked" stands after their pin, before
 * dkim's comment.
 */
export const IssueThread: Story = {
    args: { item: I1_ISSUE, detail: I1_ISSUE_DETAIL, viewer: THREAD_VIEWER, lookedAt: SAMPLE_NOW - 4 * HOUR },
    parameters: ON_PAGE,
};

/**
 * F5 on a page: pushes with their commits, a burst, the comments and the CI's failed checks by time; mlaine last looked
 * at it three hours ago and asked for a review and commented since, so "1 new since you looked" stands before dkim's
 * comment.
 */
export const PullRequestThread: Story = {
    args: {
        item: F5_PULL_REQUEST,
        detail: F5_PULL_REQUEST_DETAIL,
        viewer: THREAD_VIEWER,
        lookedAt: SAMPLE_NOW - 3 * HOUR,
    },
    parameters: ON_PAGE,
};

/** F9: the same pull request in the side panel. */
export const PullRequestThreadInPanel: Story = { args: PullRequestThread.args };

/** The user's comment on its way among the events: after everything GitHub told, then one not sent. */
export const SendingAmongEvents: Story = {
    args: {
        item: I1_ISSUE,
        detail: {
            ...I1_ISSUE_DETAIL,
            comments: {
                ...I1_ISSUE_DETAIL.comments,
                totalCount: 3,
                nodes: [
                    ...I1_ISSUE_DETAIL.comments.nodes,
                    {
                        id: 'pending:1',
                        url: I1_ISSUE.url,
                        author: { login: SAMPLE_VIEWER.login, avatarUrl: SAMPLE_VIEWER.avatarUrl },
                        body: 'Pinned it until #15 lands.',
                        bodyHtml: '',
                        // This device's clock, behind GitHub's: it still comes after everything GitHub told.
                        createdAt: new Date(SAMPLE_NOW - 3 * 60 * 60_000).toISOString(),
                        lastEditedAt: null,
                        viewerCanUpdate: false,
                        viewerCanDelete: false,
                        pendingBody: 'Pinned it until #15 lands.',
                    },
                ],
            },
        },
        viewer: { login: SAMPLE_VIEWER.login, avatarUrl: SAMPLE_VIEWER.avatarUrl },
        failedComments: [{ ...FAILED_COMMENTS[0]!, itemId: I1_ISSUE.id }],
    },
};

/** The description left empty, a comment edited since, and the user's own on its way: the text as typed, "Sending…". */
export const EditedAndSending: Story = {
    args: {
        detail: {
            ...D1_ISSUE_DETAIL,
            bodyHtml: '',
            comments: {
                totalCount: 2,
                first: [],
                olderCursor: null,
                nodes: [
                    {
                        ...D1_ISSUE_DETAIL.comments.nodes[0]!,
                        lastEditedAt: D1_ISSUE_DETAIL.comments.nodes[0]!.createdAt,
                    },
                    {
                        id: 'pending:1',
                        url: D1_ISSUE.url,
                        author: { login: SAMPLE_VIEWER.login, avatarUrl: SAMPLE_VIEWER.avatarUrl },
                        body: 'Fixed in #1205.\n\nThe series start is converted when it is created.',
                        bodyHtml: '',
                        createdAt: new Date(SAMPLE_NOW).toISOString(),
                        lastEditedAt: null,
                        viewerCanUpdate: false,
                        viewerCanDelete: false,
                        pendingBody: 'Fixed in #1205.\n\nThe series start is converted when it is created.',
                    },
                ],
            },
        },
    },
};

/** I4's "Not sent": two of the user's comments GitHub did not take, after those read, each with why, Discard and Retry. */
export const NotSent: Story = {
    args: {
        item: F1_PULL_REQUEST,
        detail: F1_PULL_REQUEST_DETAIL,
        viewer: { login: SAMPLE_VIEWER.login, avatarUrl: SAMPLE_VIEWER.avatarUrl },
        canRetry: true,
        failedComments: FAILED_COMMENTS,
        onRetry: fn(),
        onDiscard: fn(),
    },
};

/** Not sent where the user may no longer comment: the text stays to copy and Discard works; no Retry. */
export const NotSentReadOnly: Story = {
    args: {
        ...NotSent.args,
        canRetry: false,
        canQuote: false,
        failedComments: FAILED_COMMENTS.slice(0, 1),
    },
};

/** F15: the user's edit of their comment GitHub did not take, open again in place with the text and why. */
export const EditRefused: Story = {
    args: {
        failedEdits: [
            {
                itemId: D1_ISSUE.id,
                commentId: 'C_2',
                body: 'Opened #1205 — converting at creation. Migrating existing series in a follow-up.',
                reason: { kind: 'refused', message: 'Body is too long.' },
            } satisfies FailedTextEdit,
        ],
        onEdit: fn(),
        onDiscardEdit: fn(),
    },
};

/** F15's third row: the refused edit, counted as changed, asked to be left: its footer asks to discard it. */
export const EditAsksToDiscard: Story = {
    args: EditRefused.args,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(await canvas.findByRole('button', { name: 'Cancel' }));
        await expect(await canvas.findByRole('status')).toHaveTextContent('Discard your changes to this comment?');
    },
};

/**
 * I2-like, on a page: I1's thread grown long — the first two items above the fold, the middle folded to one band with
 * its counts by group, the newest five below.
 */
export const LongThread: Story = { args: { item: I1_ISSUE, detail: longThread() }, parameters: ON_PAGE };

/** The same in the side panel, the band on two lines. */
export const LongThreadInPanel: Story = { args: LongThread.args };

/**
 * I2 in the side panel: I1's issue closed by #15, the middle folded; mlaine last looked after dkim's comment, so "4 new
 * since you looked" stands before sofiab's close.
 */
export const ClosedIssueThread: Story = {
    args: { item: I2_ISSUE, detail: I2_ISSUE_DETAIL, viewer: THREAD_VIEWER, lookedAt: SAMPLE_NOW - 30 * MINUTE },
};

/** F16, left: opened the first time, before its thread is on this device — no description card, the rail's skeleton. */
export const Loading: Story = { args: { detail: null } };

/** F16, middle: nothing happened yet — the rail runs from the description straight to the composer. */
export const Empty: Story = {
    args: {
        detail: {
            ...D1_ISSUE_DETAIL,
            comments: { totalCount: 0, first: [], nodes: [], olderCursor: null },
        },
    },
};

/** F16, right: GitHub did not give the thread — no description card; why, Try again and Open on GitHub. */
export const Failed: Story = { args: { detail: null, failed: true, readAgain: fn(() => Promise.resolve()) } };

/**
 * F12: the pull request with sofiab's review — its open thread on `src/store/db.ts` with Reply… and Resolve thread, its
 * resolved one folded — written through code review's writing (here one that keeps its boxes in memory).
 */
export const CodeThreads: Story = {
    args: {
        item: F1_PULL_REQUEST,
        detail: {
            ...F1_PULL_REQUEST_DETAIL,
            reviewSummaries: [...F1_PULL_REQUEST_DETAIL.reviewSummaries, CHANGES_REQUESTED_REVIEW.review],
        },
        viewer: REVIEW_VIEWER,
        people: [REVIEW_VIEWER],
        reviewThreads: [DB_THREAD, SCHEMA_THREAD],
        reviewWriting: new FakeReviewWriting(),
    },
    parameters: ON_PAGE,
};

/** F10, `Activity / Code thread · replying`: Reply… opened the editor in the thread's band, Cancel and Reply. */
export const CodeThreadReplying: Story = {
    args: { ...CodeThreads.args, reviewWriting: new FakeReviewWriting() },
    parameters: ON_PAGE,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(await canvas.findByRole('button', { name: 'Reply…' }));
        await userEvent.type(
            await canvas.findByRole('textbox', { name: 'Reply' }),
            'And 4a1c9e2 adds a base in another repository to the e2e.',
        );
    },
};

/** I1's thread with 16 more comments by sofiab, an hour apart, after its events. */
function longThread(): IssueDetail {
    const [template] = I1_ISSUE_DETAIL.comments.nodes;
    const more = Array.from({ length: 16 }, (_, index): ItemComment => ({
        ...template!,
        id: `C_LONG_${index + 1}`,
        bodyHtml: `<p>Follow-up ${index + 1}.</p>`,
        createdAt: new Date(SAMPLE_NOW - (17 - index) * 60 * 60_000 + 30 * 60_000).toISOString(),
    }));
    const { comments } = I1_ISSUE_DETAIL;
    return { ...I1_ISSUE_DETAIL, comments: { ...comments, totalCount: 18, nodes: [...comments.nodes, ...more] } };
}
