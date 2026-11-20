import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { DB_THREAD, DRAFT_THREAD, REVIEW_VIEWER, SCHEMA_THREAD, sampleReviewThread } from '@/testing/sampleReviews.js';
import { useSampleReviewCommentActions } from '@/testing/useSampleReviewCommentActions.js';
import { withReadingCursor } from '@/testing/withReadingCursor.js';

import type { CodeThreadReplies } from './CodeThreadReplies.js';
import ItemThreadCodeThread from './ItemThreadCodeThread.vue';

/** As wide as a thread in a review's card in a panel. */
const IN_REVIEW = 440;
/** The thread's own stop. */
const DB_STOP = `thread:${DB_THREAD.id}`;
/** The viewer may write in the thread, no reply open: its keys can be shown. */
const REPLIES: CodeThreadReplies = {
    repository: 'kedrzu/githq',
    itemNumber: 1,
    people: [],
    saveLabel: 'Reply',
    get: () => null,
    getResolveFailure: () => null,
    getDeleteFailure: () => null,
    setText: () => undefined,
    setAsking: () => undefined,
    send: () => undefined,
    cancel: () => undefined,
};

const meta = {
    component: ItemThreadCodeThread,
    args: {
        thread: DB_THREAD,
        viewer: REVIEW_VIEWER,
        onHide: fn(),
        onReply: fn(),
        onSetResolved: fn(),
    },
    // With the view's comment actions (`parameters.menu`).
    render: (args, { parameters }) => ({
        components: { ItemThreadCodeThread },
        setup: () => ({ args, commentActions: parameters.menu ? useSampleReviewCommentActions() : null }),
        template: `
          <div style="width: ${IN_REVIEW}px; padding: 16px; background: #0d1117">
            <ItemThreadCodeThread v-bind="args" :comment-actions="commentActions" />
          </div>`,
    }),
} satisfies Meta<typeof ItemThreadCodeThread>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Activity / Code thread`: the code, two comments, Reply… and Resolve thread. */
export const Open: Story = {};

/** `· resolved`, opened from its row: the head with Hide, Unresolve and who resolved it. */
export const Resolved: Story = { args: { thread: SCHEMA_THREAD } };

/** `· outdated`: the code moved on since, the excerpt says so. */
export const Outdated: Story = { args: { thread: { ...DB_THREAD, isOutdated: true } } };

/** GitHub lets the viewer neither reply nor resolve: no band offers either. */
export const ReadOnly: Story = {
    args: { thread: { ...DB_THREAD, viewerCanReply: false, viewerCanResolve: false, viewerCanUnresolve: false } },
};

/** Resolved, and the viewer may not open it again: who resolved it, and no Unresolve. */
export const ResolvedCannotUnresolve: Story = {
    args: { thread: { ...SCHEMA_THREAD, viewerCanUnresolve: false } },
};

/** A thread of the viewer's draft review: its comment "Pending", no reply or resolve. */
export const Draft: Story = { args: { thread: DRAFT_THREAD, draft: true } };

/** A line wider than the card: the code scrolls sideways in its frame, the card keeps its width. */
export const LongLine: Story = {
    args: {
        thread: sampleReviewThread({
            id: 'T_long',
            path: 'src/sync/engine.ts',
            hunk: [
                '@@ -12,2 +12,2 @@',
                ' const pending = await store.pending.all()',
                '+const merged = await mergeRemoteChanges(pending, { strategy: "lastWriteWins", keepLocalDrafts: true, notify: true })',
            ].join('\n'),
            lines: [12, 13],
            comments: [[REVIEW_VIEWER, '<p>Wraps badly in a terminal too.</p>', 60_000, 'R_long']],
        }),
    },
};

/**
 * `Review / Comment · current`: the reading cursor on its second comment, in a review — the comment tinted from the
 * card's edge to its edge, the card's border `current-edge`, and `R` and `H` beside Reply… and Resolve thread.
 */
export const CurrentComment: Story = {
    args: { replies: REPLIES },
    decorators: [withReadingCursor('T_db_1', ['T_db_1', DB_STOP, 'R_review'])],
};

/** The cursor on the card itself, in its bands (focus on Reply…): marked, both keys shown, no comment tinted. */
export const Current: Story = {
    args: { replies: REPLIES },
    decorators: [withReadingCursor(DB_STOP, [DB_STOP, 'R_review'])],
};

/** Resolved and opened, the cursor in it: `H` beside Unresolve. */
export const CurrentResolved: Story = {
    args: { thread: SCHEMA_THREAD, replies: REPLIES },
    decorators: [withReadingCursor(`thread:${SCHEMA_THREAD.id}`)],
};

/** The cursor elsewhere on the page: nothing marked, no key beside Reply… or Resolve thread. */
export const CursorElsewhere: Story = {
    args: { replies: REPLIES },
    decorators: [withReadingCursor('description')],
};

/** `· linked`, where no cursor is shown (an item's panel, code review): the accent border, the comment the location. */
export const Linked: Story = { args: { linkedAnchor: 'discussion_T_db_1' } };

/** On an item's page the comment the address names is only where the cursor starts: current, no accent. */
export const CurrentLinkedComment: Story = {
    args: { linkedAnchor: 'discussion_T_db_1' },
    decorators: [withReadingCursor('T_db_1', ['T_db_1', DB_STOP])],
};

/** With the view's actions: each comment has its ⋯, shown on hover. */
export const WithCommentActions: Story = { parameters: { menu: true } };
