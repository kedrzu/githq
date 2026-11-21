import type { Meta, StoryObj } from '@storybook/vue3-vite';

import GitHubHtml from '@/item/GitHubHtml.vue';
import { D1_ISSUE, D1_ISSUE_DETAIL } from '@/testing/sampleItemDetails.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';
import { withReadingCursor } from '@/testing/withReadingCursor.js';

import CommentCard from './CommentCard.vue';
import CommentMenu from './CommentMenu.vue';
import CommentVerdict from './CommentVerdict.vue';

/** The thread's width in a panel. */
const IN_PANEL = 512;
/** Code review's conversation at its narrowest: the card in its narrow layout (`Activity / Comment · narrow`). */
const NARROW = 312;
/** A login as long as GitHub takes. */
const LONG_LOGIN = 'a-very-long-github-login-name-here';

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
    // On an item view's background, as wide as the thread in a panel (or `parameters.width`); GitHub's rendering as
    // the text, or the text as typed (`parameters.typed`); a review's verdict (`parameters.verdict`), its threads at
    // the head's end (`parameters.tail`) and the ⋯ (`parameters.menu`). The failed card's band is `CommentFailedCard`'s.
    render: (args, { parameters }) => ({
        components: { CommentMenu, CommentVerdict, GitHubHtml, CommentCard },
        setup: () => ({
            args,
            html: parameters.html ?? COMMENT.bodyHtml,
            typed: parameters.typed,
            verdict: parameters.verdict,
            tail: parameters.tail,
            menu: parameters.menu ?? false,
            width: parameters.width ?? IN_PANEL,
        }),
        template: `
          <div :style="{ width: width + 'px', padding: '20px 0', background: '#11161c' }" tid="frame">
            <CommentCard v-bind="args">
              <template v-if="verdict" #verdict><CommentVerdict :state="verdict" /></template>
              <template v-if="tail" #tail><span>{{ tail }}</span></template>
              <p v-if="typed" style="margin: 0; white-space: pre-wrap" v-text="typed" />
              <GitHubHtml v-else :html="html" />
              <template v-if="menu" #menu><CommentMenu :can-edit="true" :can-quote="true" /></template>
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

/** In code review's conversation at 340 px: no gutter, the avatar starts the head, the age without the verb. */
export const Narrow: Story = {
    parameters: { width: NARROW, menu: true },
};

/** The narrow description: the Author chip kept while there is room. */
export const NarrowDescription: Story = {
    args: {
        author: D1_ISSUE.author,
        createdAt: D1_ISSUE.createdAt,
        description: true,
    },
    parameters: { width: NARROW, menu: true, html: D1_ISSUE_DETAIL.bodyHtml },
};

/**
 * A very long login on a review with its threads, narrow: the login is cut short, the verdict, the age and the ⋯
 * stay, and the threads go to a line under the text.
 */
export const NarrowLongLogin: Story = {
    args: { author: { login: LONG_LOGIN, avatarUrl: '' } },
    parameters: { width: NARROW, menu: true, verdict: 'CHANGES_REQUESTED', tail: '2 threads · 1 resolved' },
};

/** The same review wide: the threads at the head's end. */
export const WideReview: Story = {
    parameters: { menu: true, verdict: 'CHANGES_REQUESTED', tail: '2 threads · 1 resolved' },
};

/** The thread at its widest: the threads and the Author chip follow the time, the ⋯ stays at the edge. */
export const WidestReview: Story = {
    parameters: { width: 1300, menu: true, verdict: 'CHANGES_REQUESTED', tail: '2 threads · 1 resolved' },
};

/** `Activity / Comment · current`: the reading cursor on it, the border `current-edge`, the head `current-header`. */
export const Current: Story = {
    args: { stop: COMMENT.id },
    parameters: { menu: true },
    decorators: [withReadingCursor(COMMENT.id)],
};

/**
 * `· current` around the cursor: a review's card with the cursor on a comment of one of its code threads, marked as if
 * on it.
 */
export const Within: Story = {
    args: { stop: COMMENT.id },
    parameters: { menu: true },
    decorators: [withReadingCursor('T_comment', ['T_comment', 'thread:T', COMMENT.id])],
};

/** `· linked`, where no cursor is shown (an item's panel, code review's conversation): the `current-edge` border. */
export const Linked: Story = {
    args: { stop: COMMENT.id, linked: true },
    parameters: { menu: true },
};

/** The address names it on an item's page: only where the cursor starts, marked current, no border of its own. */
export const CurrentLinked: Story = {
    args: { stop: COMMENT.id, linked: true },
    parameters: { menu: true },
    decorators: [withReadingCursor(COMMENT.id)],
};

/** `Activity / Review · pending, current`: the draft review keeps its amber border, the head alone takes the tint. */
export const CurrentPending: Story = {
    args: { author: VIEWER, stop: 'draftReview', pending: true, name: 'Your review' },
    decorators: [withReadingCursor('draftReview')],
};

/** `· narrow, current`: the narrow card marked the same. */
export const CurrentNarrow: Story = {
    args: { stop: COMMENT.id },
    parameters: { width: NARROW, menu: true },
    decorators: [withReadingCursor(COMMENT.id)],
};

/** A stop the cursor is not on: no mark. */
export const NotCurrent: Story = {
    args: { stop: COMMENT.id },
    decorators: [withReadingCursor('description')],
};

/** No stop, as in code review's conversation: never marked, even where a cursor is on a key like its comment's. */
export const NotAStop: Story = {
    decorators: [withReadingCursor(COMMENT.id)],
};
