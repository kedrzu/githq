import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { CircleCheck, CircleX, GitMerge, GitPullRequestDraft, Hourglass } from 'lucide-vue-next';

import PullRequestVerdictLine from './PullRequestVerdictLine.vue';

const meta = {
    component: PullRequestVerdictLine,
    args: {
        verdict: {
            tone: 'success',
            icon: CircleCheck,
            text: 'Ready to merge',
            aside: 'Approved · checks passed · no conflicts',
        },
    },
    render: args => ({
        components: { PullRequestVerdictLine },
        setup: () => ({ args }),
        template: '<div style="width: 560px; background: #16181c"><PullRequestVerdictLine v-bind="args" /></div>',
    }),
} satisfies Meta<typeof PullRequestVerdictLine>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Ready, green: the opened item's standing heads with it. */
export const Ready: Story = { args: { tag: 'h2' } };

/** Held back, red: in the merge panel, with its wider inset. */
export const CannotMerge: Story = {
    args: {
        verdict: { tone: 'danger', icon: CircleX, text: "Can't merge yet", aside: 'A required check failed' },
        inset: 'lg',
    },
};

/** Waiting, amber. */
export const NotReady: Story = {
    args: { verdict: { tone: 'warning', icon: Hourglass, text: 'Not ready yet', aside: 'waiting for review' } },
};

/** Merged, purple, nothing after it. */
export const Merged: Story = { args: { verdict: { tone: 'done', icon: GitMerge, text: 'Merged', aside: null } } };

/** A draft, grey and untinted. */
export const Draft: Story = {
    args: { verdict: { tone: 'muted', icon: GitPullRequestDraft, text: 'Draft', aside: 'not ready for review' } },
};
