import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { SCHEMA_THREAD } from '@/testing/sampleReviews.js';

import ItemThreadResolvedRow from './ItemThreadResolvedRow.vue';

const meta = {
    component: ItemThreadResolvedRow,
    args: { thread: SCHEMA_THREAD, onClick: fn() },
    render: args => ({
        components: { ItemThreadResolvedRow },
        setup: () => ({ args }),
        template: `
          <div style="width: 440px; padding: 16px; background: #0d1117">
            <ItemThreadResolvedRow v-bind="args" />
          </div>`,
    }),
} satisfies Meta<typeof ItemThreadResolvedRow>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Activity / Resolved threads` in a review: the file, who wrote, how many comments, Show. */
export const InReview: Story = {};

/** Under a code comment's head, which says the file: the first line of its first comment instead. */
export const WithExcerpt: Story = { args: { says: 'excerpt' } };

/** In a review where another row has the same file: the file, then the first line of its first comment. */
export const WithPathAndExcerpt: Story = { args: { says: 'both' } };
