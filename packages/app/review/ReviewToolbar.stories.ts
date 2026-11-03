import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

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
        onBack: fn(),
    },
} satisfies Meta<typeof ReviewToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Split with whitespace shown: the button says just the layout. */
export const Split: Story = {};

/** CR4: "Split · whitespace hidden". */
export const WhitespaceHidden: Story = { args: { hideWhitespace: true } };

/** CR5: unified. */
export const Unified: Story = { args: { layout: 'unified', hideWhitespace: true } };

/** Opened at an address, before the pull request's row is known. */
export const NotKnownYet: Story = { args: { item: null } };

/** A merged pull request. */
export const Merged: Story = {
    args: { item: { ...samplePullRequest('PR_1'), title: 'Sync: queue edits made offline', merged: true } },
};
