import type { Meta, StoryObj } from '@storybook/vue3-vite';
import {
    ChevronRight,
    CircleCheck,
    CircleDashed,
    CircleX,
    GitBranch,
    GitMerge,
    Hourglass,
    ListOrdered,
} from 'lucide-vue-next';

import MergeCondition from './MergeCondition.vue';

const meta = {
    component: MergeCondition,
    args: { icon: CircleX, tone: 'danger', label: 'Conflicts', text: "With main. Resolved in GitHub's editor" },
    // A line of the merge panel, above its checks.
    render: args => ({
        components: { MergeCondition },
        setup: () => ({ args }),
        template: '<div style="width: 640px; background: #151b23"><MergeCondition v-bind="args" /></div>',
    }),
} satisfies Meta<typeof MergeCondition>;

export default meta;

type Story = StoryObj<typeof meta>;

/** PM19: what holds the merge, in red. */
export const Danger: Story = {};

/** PM20: what holds it until a step is taken, in amber. */
export const Warning: Story = { args: { icon: GitBranch, tone: 'warning', label: 'Branch', text: 'Behind main' } };

/** PM15: in the merge queue, its icon in the accent. */
export const Accent: Story = {
    args: { icon: ListOrdered, tone: 'accent', label: 'Queue', text: '2nd · waiting for checks' },
};

/** Met, in green. */
export const Success: Story = {
    args: { icon: CircleCheck, tone: 'success', label: 'Reviews', text: 'Approved by sofiab and dkim' },
};

/** Merged, in the merged tone. */
export const Done: Story = { args: { icon: GitMerge, tone: 'done', label: 'Merge', text: 'Squashed into main' } };

/** PM22: not known yet, in grey. */
export const Muted: Story = { args: { icon: CircleDashed, tone: 'muted', label: 'Conflicts', text: 'Not known yet' } };

/** PM13: with a quieter aside at the end. */
export const WithAside: Story = {
    args: {
        icon: Hourglass,
        tone: 'warning',
        label: 'Reviews',
        text: 'Waiting for dkim',
        aside: '1 approval · sofiab',
    },
};

/** What the line offers at its end: the checks' chevron. */
export const WithChevron: Story = {
    args: { icon: CircleCheck, tone: 'success', label: 'Checks', text: 'All 9 passed' },
    render: args => ({
        components: { MergeCondition, ChevronRight },
        setup: () => ({ args }),
        template: `<div style="width: 640px; background: #151b23">
            <MergeCondition v-bind="args"><ChevronRight aria-hidden="true" style="width: 13px; height: 13px" /></MergeCondition>
        </div>`,
    }),
};
