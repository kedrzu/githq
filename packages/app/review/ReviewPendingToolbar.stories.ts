import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ReviewPendingToolbar from './ReviewPendingToolbar.vue';

const meta = {
    component: ReviewPendingToolbar,
    args: { commentCount: 3, githubUrl: 'https://github.com/fitloop/webapp/pull/1202/files' },
} satisfies Meta<typeof ReviewPendingToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR35, CR36: comments waiting. */
export const Several: Story = {};

/** One comment says so in the singular. */
export const One: Story = { args: { commentCount: 1 } };

/** Too narrow for the sentence, it gives way and the button stays. */
export const Narrow: Story = {
    render: args => ({
        components: { ReviewPendingToolbar },
        setup: () => ({ args }),
        template: `<div style="width: 340px"><ReviewPendingToolbar v-bind="args" /></div>`,
    }),
};
