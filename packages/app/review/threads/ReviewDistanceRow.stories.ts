import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { sampleThread } from '@/testing/sampleThreads.js';

import type { ThreadOnHiddenLine } from './placeThreads.js';
import ReviewDistanceRow from './ReviewDistanceRow.vue';

const PLACEMENT: ThreadOnHiddenLine = {
    kind: 'hiddenLine',
    thread: sampleThread(),
    side: 'after',
    line: 214,
    approximate: false,
    gap: { beforeStart: 40, beforeEnd: 240, afterStart: 41, afterEnd: 241 },
    distance: 172,
    direction: 'down',
    firstLine: 212,
    whitespaceChange: false,
};

const meta = {
    component: ReviewDistanceRow,
    args: { row: { kind: 'distance', key: 'mark', placement: PLACEMENT }, onExpand: fn() },
    render: args => ({
        components: { ReviewDistanceRow },
        setup: () => ({ args }),
        template: `<div style="width: 1000px"><ReviewDistanceRow v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof ReviewDistanceRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR11: below the nearest change, and "Expand to here" asks for what is between. */
export const FurtherDown: Story = {
    play: async ({ args, canvas }) => {
        await expect(canvas.getByText('172 lines further down')).toBeInTheDocument();
        await userEvent.click(canvas.getByRole('button', { name: /Expand to.here/u }));
        await expect(args.onExpand).toHaveBeenCalled();
    },
};

/** Above the nearest change. */
export const FurtherUp: Story = {
    args: { row: { kind: 'distance', key: 'mark', placement: { ...PLACEMENT, direction: 'up', distance: 1 } } },
};

/** CR11: a line changed in whitespace alone, that being hidden. */
export const HiddenWhitespace: Story = {
    args: { row: { kind: 'distance', key: 'mark', placement: { ...PLACEMENT, whitespaceChange: true } } },
};

/** CR11: what is left of the file's last gap under the code shown for a thread. */
export const ToFileEnd: Story = {
    args: { row: { kind: 'fileEnd', key: 'end', hidden: 38, lines: { start: 215, end: 253 } } },
    play: async ({ canvas }) => {
        await expect(canvas.getByText('38 lines to the end of the file')).toBeInTheDocument();
        await expect(canvas.getByText('no changes there')).toBeInTheDocument();
    },
};
