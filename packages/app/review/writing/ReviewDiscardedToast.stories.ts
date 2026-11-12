import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import Toaster from '@/components/Toaster.vue';

import ReviewDiscardedToast from './ReviewDiscardedToast.vue';

const meta = {
    component: ReviewDiscardedToast,
    args: {
        discarded: {
            target: { id: 'box', path: 'src/sync/engine.ts', side: 'after', line: 51, startLine: null, threadId: null },
            text: 'scheduleRetry needs a ceiling, or a dead token retries every 2 s forever.',
        },
        onRestore: fn(),
        onClose: fn(),
    },
    parameters: {
        a11y: {
            context: {
                // reka-ui's toast viewport's focus guards, as in `Toast.stories.tsx`.
                exclude: ['[role="region"] > span[aria-hidden="true"][tabindex="0"]'],
            },
        },
    },
    render: args => ({
        components: { ReviewDiscardedToast, Toaster },
        setup: () => ({ args }),
        template: `<div style="position: relative; height: 320px"><Toaster contained><ReviewDiscardedToast v-bind="args" /></Toaster></div>`,
    }),
} satisfies Meta<typeof ReviewDiscardedToast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR98: a comment on a line, its text quoted; Restore on ⌘Z, Dismiss with no key. */
export const OnLine: Story = {};

/** A comment on a range, so long its quote is clamped. */
export const OnLines: Story = {
    args: {
        discarded: {
            target: { id: 'box', path: 'src/sync/engine.ts', side: 'after', line: 51, startLine: 48, threadId: null },
            text: 'This retries forever.\n\nA dead token makes every request fail the same way, so the backoff never ends and the queue never drains. Cap it at five tries, then surface the failure in the status bar, the way the sync engine does for a rate limit. And the jitter should be random per client, or every tab retries in step.',
        },
    },
};

/** A reply in a thread. */
export const Reply: Story = {
    args: {
        discarded: {
            target: {
                id: 'box',
                path: 'src/sync/engine.ts',
                side: 'after',
                line: 51,
                startLine: null,
                threadId: 'T_1',
            },
            text: 'Fine with keeping both.',
        },
    },
};
