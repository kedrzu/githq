import type { Meta, StoryObj } from '@storybook/vue3-vite';

import LabelDots from './LabelDots.vue';

const meta = {
    component: LabelDots,
    args: {
        labels: [
            { name: 'bug', color: 'd73a4a' },
            { name: 'calendar', color: 'd6a23a' },
        ],
    },
} satisfies Meta<typeof LabelDots>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A dot per label, the names said together (the rows' stories check the name). */
export const Labels: Story = {};
