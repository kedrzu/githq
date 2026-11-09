import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { D1_ISSUE, D1_ISSUE_DETAIL, F1_PULL_REQUEST, F1_PULL_REQUEST_DETAIL } from '@/testing/sampleItemDetails.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import ItemThread from './ItemThread.vue';
import ItemThreadComposer from './ItemThreadComposer.vue';

/** The main column's content in a panel; a page's is `ON_PAGE`. */
const IN_PANEL = 512;
/** The reading width a page keeps its main column to. */
const ON_PAGE = { width: 760 };

const meta = {
    component: ItemThread,
    args: {
        item: D1_ISSUE,
        detail: D1_ISSUE_DETAIL,
        now: SAMPLE_NOW,
        loadAll: fn(() => Promise.resolve()),
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
                        bodyHtml: '',
                        createdAt: new Date(SAMPLE_NOW).toISOString(),
                        lastEditedAt: null,
                        pendingBody: 'Fixed in #1205.\n\nThe series start is converted when it is created.',
                    },
                ],
            },
        },
    },
};

/** Opened before its detail is read: the composer is there already. */
export const Loading: Story = { args: { detail: null } };
