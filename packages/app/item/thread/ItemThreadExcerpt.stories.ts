import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { DB_THREAD } from '@/testing/sampleReviews.js';

import ItemThreadExcerpt from './ItemThreadExcerpt.vue';

const meta = {
    component: ItemThreadExcerpt,
    args: { thread: DB_THREAD },
    render: args => ({
        components: { ItemThreadExcerpt },
        setup: () => ({ args }),
        template: `
          <div style="width: 400px; padding: 16px; background: #0d1117">
            <ItemThreadExcerpt v-bind="args" />
          </div>`,
    }),
} satisfies Meta<typeof ItemThreadExcerpt>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Activity / Code excerpt`: the file, its lines, a line deleted and one added. */
export const Lines: Story = {};

/** The code moved on since: "Outdated", and the lines it was written on. */
export const Outdated: Story = { args: { thread: { ...DB_THREAD, isOutdated: true, line: null } } };

/** A comment on the whole file: no lines to show. */
export const OnFile: Story = {
    args: {
        thread: {
            ...DB_THREAD,
            subjectType: 'FILE',
            comments: DB_THREAD.comments.map(comment => ({ ...comment, diffHunk: '' })),
        },
    },
};
