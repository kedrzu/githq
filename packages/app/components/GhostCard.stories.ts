import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { withMotion } from '@/testing/withMotion.js';

import GhostCard from './GhostCard.vue';

const meta = {
    component: GhostCard,
    decorators: [withMotion, () => ({ template: '<div style="width: 252px; padding: 16px"><story /></div>' })],
} satisfies Meta<typeof GhostCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Empty / Ghost card`: a meta bar over two title bars, on the card's own fainter surface. */
export const Default: Story = {};
