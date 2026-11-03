import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';

import PullRequestSize from './PullRequestSize.vue';

const meta = {
    component: PullRequestSize,
    args: { additions: 1092, deletions: 640 },
} satisfies Meta<typeof PullRequestSize>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The lines added and removed, in the app's number format and the real minus sign. */
export const Default: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByText('+1,092')).toBeVisible();
        await expect(canvas.getByText('−640')).toBeVisible();
    },
};
