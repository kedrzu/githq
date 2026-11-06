import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { withMotion } from '@/testing/withMotion.js';

import GhostRow from './GhostRow.vue';

const meta = {
    component: GhostRow,
    args: { titleWidth: 420, metaWidth: 240 },
    decorators: [withMotion],
} satisfies Meta<typeof GhostRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Empty / Ghost row`: the icon dot and the title strong, the meta and the age weak. */
export const Default: Story = {};

/** In a pane narrower than its title: the title bar shrinks, the age stays at the end. */
export const Narrow: Story = {
    args: { titleWidth: 510 },
    decorators: [() => ({ template: '<div style="width: 320px"><story /></div>' })],
};
