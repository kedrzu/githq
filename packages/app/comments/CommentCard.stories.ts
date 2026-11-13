import type { Meta, StoryObj } from '@storybook/vue3-vite';

import GitHubHtml from '@/item/GitHubHtml.vue';
import { D1_ISSUE, D1_ISSUE_DETAIL } from '@/testing/sampleItemDetails.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import CommentCard from './CommentCard.vue';

/** The thread's width in a panel. */
const IN_PANEL = 512;

const COMMENT = D1_ISSUE_DETAIL.comments.nodes[0]!;
const VIEWER = {
    login: SAMPLE_VIEWER.login,
    avatarUrl: SAMPLE_VIEWER.avatarUrl,
};
const TYPED = 'Fixed in #1205.\n\nThe series start is converted when it is created.';

const meta = {
    component: CommentCard,
    args: {
        author: COMMENT.author,
        createdAt: COMMENT.createdAt,
        now: SAMPLE_NOW,
    },
    // On an item view's background, as wide as the thread in a panel; GitHub's rendering as the text, or the text
    // as typed (`parameters.typed`). The failed card's band is `ItemThread`'s (its `NotSent` story).
    render: (args, { parameters }) => ({
        components: { GitHubHtml, CommentCard },
        setup: () => ({
            args,
            html: parameters.html ?? COMMENT.bodyHtml,
            typed: parameters.typed,
        }),
        template: `
          <div style="width: ${IN_PANEL}px; padding: 20px 0; background: #11161c">
            <CommentCard v-bind="args">
              <p v-if="typed" style="margin: 0; white-space: pre-wrap" v-text="typed" />
              <GitHubHtml v-else :html="html" />
            </CommentCard>
          </div>`,
    }),
} satisfies Meta<typeof CommentCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The item's description: the "Author" chip, the age in words. */
export const Description: Story = {
    args: {
        author: D1_ISSUE.author,
        createdAt: D1_ISSUE.createdAt,
        description: true,
    },
    parameters: { html: D1_ISSUE_DETAIL.bodyHtml },
};

/** A comment: the age short. */
export const Comment: Story = {};

/** A comment changed since: "· edited". */
export const Edited: Story = { args: { edited: true } };

/** The user's own on its way: "Sending…" in place of the age, the text as typed. */
export const Sending: Story = {
    args: { author: VIEWER, sending: true },
    parameters: { typed: TYPED },
};

/** One GitHub did not take: "Not sent" in red like the border. */
export const Failed: Story = {
    args: { author: VIEWER, createdAt: undefined, failed: true },
    parameters: { typed: TYPED },
};
