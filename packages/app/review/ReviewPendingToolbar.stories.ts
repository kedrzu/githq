import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ReviewPendingToolbar from './ReviewPendingToolbar.vue';

const meta = {
    component: ReviewPendingToolbar,
    args: { commentCount: 3, finish: { kind: 'idle' } },
} satisfies Meta<typeof ReviewPendingToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR35, CR36: comments waiting. */
export const Several: Story = {};

/** One comment says so in the singular. */
export const One: Story = { args: { commentCount: 1 } };

/** On its way to GitHub: the ways out wait for the answer. */
export const Sending: Story = {
    args: { finish: { kind: 'sending', finish: { kind: 'submit', choice: { event: 'COMMENT', body: '' } } } },
};

/** CR76: GitHub refused, in its words, and everything is kept. */
export const Refused: Story = {
    args: {
        finish: {
            kind: 'failed',
            finish: { kind: 'submit', choice: { event: 'APPROVE', body: '' } },
            failure: { kind: 'refused', message: 'Can not approve your own pull request' },
        },
    },
};

/** GitHub didn't answer, which says nothing was refused. */
export const NotReached: Story = {
    args: {
        finish: {
            kind: 'failed',
            finish: { kind: 'submit', choice: { event: 'COMMENT', body: '' } },
            failure: { kind: 'notReached' },
        },
    },
};

/** Discarding failed says so, and the draft is still there. */
export const DiscardFailed: Story = {
    args: {
        finish: {
            kind: 'failed',
            finish: { kind: 'discard' },
            failure: { kind: 'refused', message: 'Could not resolve to a node' },
        },
    },
};

/** Too narrow for the sentence, it gives way and the button stays. */
export const Narrow: Story = {
    render: args => ({
        components: { ReviewPendingToolbar },
        setup: () => ({ args }),
        template: `<div style="width: 340px"><ReviewPendingToolbar v-bind="args" /></div>`,
    }),
};
