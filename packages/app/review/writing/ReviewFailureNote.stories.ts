import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ReviewFailureNote from './ReviewFailureNote.vue';

const meta = {
    component: ReviewFailureNote,
    args: { text: 'GitHub refused it: "Thread is locked". Your text is kept.' },
} satisfies Meta<typeof ReviewFailureNote>;

export default meta;

type Story = StoryObj<typeof meta>;

/** In red, under what it is about. */
export const Default: Story = {};

/** A long word breaks rather than widening the box. */
export const LongWord: Story = {
    args: { text: `GitHub refused it: "${'unbroken'.repeat(30)}".` },
    render: args => ({
        components: { ReviewFailureNote },
        setup: () => ({ args }),
        template: `<div style="width: 320px"><ReviewFailureNote v-bind="args" /></div>`,
    }),
};
