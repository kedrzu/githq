import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { samplePullRequest } from '@/testing/sampleItems.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import DraftReviewsView from './DraftReviewsView.vue';

const OLDER = {
    ...samplePullRequest('PR_482'),
    number: 482,
    title: 'Add idempotency keys to payments',
    pendingReview: {
        id: 'PRR_482',
        commentCount: 1,
        createdAt: new Date(SAMPLE_NOW - 3 * 24 * 3_600_000).toISOString(),
    },
};
const NEWER = {
    ...samplePullRequest('PR_1202'),
    number: 1202,
    title: 'Sync: queue edits made offline',
    pendingReview: { id: 'PRR_1202', commentCount: 3, createdAt: new Date(SAMPLE_NOW - 2 * 3_600_000).toISOString() },
};

const meta = {
    component: DraftReviewsView,
    args: {
        drafts: [OLDER, NEWER],
        viewerLogin: SAMPLE_VIEWER.login,
        now: SAMPLE_NOW,
        selectedId: NEWER.id,
        onOpen: fn(),
    },
} satisfies Meta<typeof DraftReviewsView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR34: the one waiting longest first, each with its count and how long it has waited. */
export const Several: Story = {};

/** The last draft gone with the list open: the sidebar's entry goes too. */
export const Empty: Story = { args: { drafts: [], selectedId: null } };
