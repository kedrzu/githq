import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ItemThreadNewSince from './ItemThreadNewSince.vue';

const meta = {
    component: ItemThreadNewSince,
    args: { count: 3 },
    // On an item view's background, as wide as a page's thread.
    render: args => ({
        components: { ItemThreadNewSince },
        setup: () => ({ args }),
        template: `
          <div style="width: 760px; padding: 20px 0; background: #11161c">
            <ItemThreadNewSince v-bind="args" />
          </div>`,
    }),
} satisfies Meta<typeof ItemThreadNewSince>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Activity / New since you looked`: "3 new since you looked" and the accent rule. */
export const Several: Story = {};
