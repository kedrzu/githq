import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent } from 'storybook/test';

import ReviewLostViewedBar from './ReviewLostViewedBar.vue';

const meta = {
    component: ReviewLostViewedBar,
    args: {
        paths: ['src/sync/engine.ts', 'src/sync/queue.ts', 'src/sync/queue.test.ts'],
        onShowOnly: fn(),
        onDismiss: fn(),
    },
} satisfies Meta<typeof ReviewLostViewedBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR62: names the files; the buttons report. */
export const Several: Story = {
    play: async ({ canvas, args }) => {
        await expect(canvas.getByRole('status')).toHaveTextContent('engine.ts, queue.ts, queue.test.ts');
        await userEvent.click(canvas.getByRole('button', { name: 'Show only these 3' }));
        await expect(args.onShowOnly).toHaveBeenCalledOnce();
        await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
        await expect(args.onDismiss).toHaveBeenCalledOnce();
    },
};

/** One file. */
export const One: Story = { args: { paths: ['src/sync/engine.ts'] } };

/** More than fit: cut off, each name still tagged in the list. */
export const Many: Story = {
    args: { paths: Array.from({ length: 60 }, (_, index) => `src/generated/file-${index}.ts`) },
};
