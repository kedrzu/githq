import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h } from 'vue';

import PhonePill from './PhonePill.vue';

const meta = {
    component: PhonePill,
    args: { onClick: fn() },
    render: args => ({ setup: () => () => h(PhonePill, args, () => 'Leave a comment…') }),
    // As wide as a phone's command line.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () =>
                    h('div', { style: { display: 'flex', width: '366px', padding: '12px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof PhonePill>;

export default meta;

type Story = StoryObj<typeof meta>;

/** At rest. */
export const Default: Story = {};

/** Busy while its click's promise runs. */
export const Busy: Story = { args: { busy: true } };
