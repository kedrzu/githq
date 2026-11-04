import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { samplePullRequest } from '@/testing/sampleItems.js';

import ReviewToolbar from './ReviewToolbar.vue';

const REFERENCE = { owner: 'fitloop', name: 'webapp', number: 1202 };

const meta = {
    component: ReviewToolbar,
    args: {
        reference: REFERENCE,
        item: { ...samplePullRequest('PR_1'), title: 'Sync: queue edits made offline' },
        githubUrl: 'https://github.com/fitloop/webapp/pull/1202/files',
        layout: 'split',
        hideWhitespace: false,
        threadsInCollapsed: true,
        fileListHidden: false,
        conversationShown: false,
        onBack: fn(),
    },
} satisfies Meta<typeof ReviewToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Split with whitespace shown: the button says just the layout. The state reaches a screen reader as its name. */
export const Split: Story = {
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('img', { name: 'Open pull request' })).toBeVisible();
    },
};

/** CR4: "Split · whitespace hidden". */
export const WhitespaceHidden: Story = { args: { hideWhitespace: true } };

/** CR5: unified. */
export const Unified: Story = { args: { layout: 'unified', hideWhitespace: true } };

/** The view options open: layout, hide whitespace and that they are kept for every pull request. */
export const ViewOptionsOpen: Story = {
    play: async ({ canvas, canvasElement }) => {
        await userEvent.click(canvas.getByRole('button', { name: 'Split' }));
        const panel = await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'View options' });
        await expect(within(panel).getByRole('switch', { name: 'Hide whitespace changes' })).toBeVisible();
        await expect(within(panel).getByRole('switch', { name: 'File list' })).toBeChecked();
        await expect(within(panel).getByRole('switch', { name: 'Conversation' })).not.toBeChecked();
    },
};

/** CR5: both columns on, each toggle a filled square. */
export const ColumnsOn: Story = { args: { conversationShown: true } };

/** Opened at an address, before the pull request's row is known: it says no state it doesn't know. */
export const NotKnownYet: Story = {
    args: { item: null },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('img', { name: 'Pull request' })).toBeVisible();
    },
};

/** A draft pull request. */
export const Draft: Story = {
    args: { item: { ...samplePullRequest('PR_1'), title: 'Sync: queue edits made offline', isDraft: true } },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('img', { name: 'Draft pull request' })).toBeVisible();
    },
};

/** A pull request closed without merging. */
export const Closed: Story = {
    args: { item: { ...samplePullRequest('PR_1'), title: 'Sync: queue edits made offline', state: 'CLOSED' } },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('img', { name: 'Closed pull request' })).toBeVisible();
    },
};

/** A merged pull request. */
export const Merged: Story = {
    args: { item: { ...samplePullRequest('PR_1'), title: 'Sync: queue edits made offline', merged: true } },
    play: async ({ canvas }) => {
        await expect(canvas.getByRole('img', { name: 'Merged pull request' })).toBeVisible();
    },
};
