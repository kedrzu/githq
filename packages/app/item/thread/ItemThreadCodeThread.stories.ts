import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { DB_THREAD, DRAFT_THREAD, REVIEW_VIEWER, SCHEMA_THREAD, sampleReviewThread } from '@/testing/sampleReviews.js';

import ItemThreadCodeThread from './ItemThreadCodeThread.vue';

/** As wide as a thread in a review's card in a panel. */
const IN_REVIEW = 440;

const meta = {
    component: ItemThreadCodeThread,
    args: {
        thread: DB_THREAD,
        viewer: REVIEW_VIEWER,
        onHide: fn(),
        onReply: fn(),
        onSetResolved: fn(),
    },
    render: args => ({
        components: { ItemThreadCodeThread },
        setup: () => ({ args }),
        template: `
          <div style="width: ${IN_REVIEW}px; padding: 16px; background: #0d1117">
            <ItemThreadCodeThread v-bind="args" />
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
