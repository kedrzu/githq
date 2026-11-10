import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { FailedComment, FailedTextEdit } from '@/edits/CommentDrafts.js';
import { D1_ISSUE, D1_ISSUE_DETAIL, F1_PULL_REQUEST, F1_PULL_REQUEST_DETAIL } from '@/testing/sampleItemDetails.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import ItemThread from './ItemThread.vue';
import ItemThreadComposer from './ItemThreadComposer.vue';

/** The main column's content in a panel; a page's is `ON_PAGE`. */
const IN_PANEL = 512;
/** The reading width a page keeps its main column to. */
const ON_PAGE = { width: 760 };

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
        loadAll: fn(() => Promise.resolve()),
        canQuote: true,
    },
    // On an item view's background, as wide as its main column (`parameters.width`), ending in the composer.
    render: (args, { parameters }) => ({
        components: { ItemThread, ItemThreadComposer },
        setup: () => ({ args, viewer: { login: SAMPLE_VIEWER.login, avatarUrl: SAMPLE_VIEWER.avatarUrl } }),
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

/** The description left empty, a comment edited since, and the user's own on its way: the text as typed, "Sending…". */
export const EditedAndSending: Story = {
    args: {
        detail: {
            ...D1_ISSUE_DETAIL,
            bodyHtml: '',
            comments: {
                totalCount: 2,
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

/** Opened before its detail is read: the composer is there already. */
export const Loading: Story = { args: { detail: null } };
