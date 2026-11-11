import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { ref } from 'vue';

import { D1_ISSUE, F1_PULL_REQUEST } from '@/testing/sampleItemDetails.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import ItemThreadComposer from './ItemThreadComposer.vue';

/** What the user typed in `Activity / Composer · issue, writing`. */
const TYPED = 'Fixed by #15: the migration keeps sub-issue links whose parent lives in another repository.';

const meta = {
    component: ItemThreadComposer,
    args: {
        item: D1_ISSUE,
        viewer: { login: SAMPLE_VIEWER.login, avatarUrl: SAMPLE_VIEWER.avatarUrl },
        canComment: true,
        canClose: true,
        readOnly: null,
        text: '',
        onEdit: fn(),
    },
    // At the end of a page's thread, at its reading width; what is typed kept as the item view keeps its draft.
    render: ({ text, ...args }) => ({
        components: { ItemThreadComposer },
        setup: () => ({ args, typed: ref(text ?? '') }),
        template: `<div style="width: 760px; padding: 20px; background: #11161c"><ItemThreadComposer v-bind="args" v-model:text="typed" /></div>`,
    }),
} satisfies Meta<typeof ItemThreadComposer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Activity / Composer · issue`: "Close issue" with its menu of reasons, Comment dimmed. */
export const OpenIssue: Story = {};

/** `Activity / Composer · issue, writing`: text typed, "Close with comment". */
export const OpenIssueWriting: Story = { args: { text: TYPED } };

/** `Activity / Composer`: an open pull request, "Close pull request". */
export const OpenPullRequest: Story = { args: { item: F1_PULL_REQUEST } };

/** `Activity / Composer · closed`: "Reopen issue". */
export const ClosedIssue: Story = { args: { item: { ...D1_ISSUE, state: 'CLOSED', stateReason: 'COMPLETED' } } };

/** `Activity / Composer · closed`, on a pull request: "Reopen pull request". */
export const ClosedPullRequest: Story = { args: { item: { ...F1_PULL_REQUEST, state: 'CLOSED' } } };

/** `Activity / Composer · merged`: nothing to close. */
export const MergedPullRequest: Story = { args: { item: { ...F1_PULL_REQUEST, state: 'MERGED', merged: true } } };

/** Someone who may comment but not close: Comment alone (K1b). */
export const CommentOnly: Story = { args: { canClose: false } };

/** `Activity / Composer · read-only`: the conversation locked to collaborators. */
export const Locked: Story = { args: { canComment: false, readOnly: 'locked' } };

/** `Activity / Composer · read-only`, the repository archived. */
export const Archived: Story = { args: { canComment: false, canClose: false, readOnly: 'archived' } };
