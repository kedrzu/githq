import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MatchedText from './MatchedText.vue';

const meta = {
    component: MatchedText,
    args: { text: 'Retry when creating a webhook fails', ranges: [11, 16] },
} satisfies Meta<typeof MatchedText>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One part marked. */
export const Marked: Story = {};

/** Several parts, from the text's start to its end. */
export const SeveralParts: Story = { args: { ranges: [0, 5, 11, 16, 31, 35] } };

/** No ranges: the plain text. */
export const Plain: Story = { args: { ranges: null } };
