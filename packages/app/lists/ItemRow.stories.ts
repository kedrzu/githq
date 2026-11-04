import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';

import { D1_ITEMS, SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import { ITEM_PROPERTIES } from './ItemProperty.js';
import ItemRow from './ItemRow.vue';

const GREEN = D1_ITEMS.find(item => item.id === 'PR_477');
if (GREEN?.kind !== 'pullRequest') {
    throw new Error('The sample work needs the pull request PR_477.');
}

const meta = {
    component: ItemRow,
    args: { item: GREEN, properties: ITEM_PROPERTIES, now: SAMPLE_NOW, viewerLogin: SAMPLE_VIEWER.login },
} satisfies Meta<typeof ItemRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** GitHub would merge it with no review decision and no review asked: followed by "Open on GitHub" or "Merge". */
export const ReadyToMerge: Story = {
    args: { item: { ...GREEN, reviewDecision: null, reviewRequests: [] } },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByText('ready to merge')).toBeVisible();
        await expect(canvas.getByRole('link', { name: /GitHub/ })).toBeVisible();
    },
};

/** "Checks passed" first, then the status: green checks that do not make it ready. */
export const ChecksPassedWaiting: Story = {
    args: { item: { ...GREEN, reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' } },
    play: async ({ canvasElement }) => {
        await expect(canvasElement).toHaveTextContent(/checks passed.*waiting for review/);
    },
};
