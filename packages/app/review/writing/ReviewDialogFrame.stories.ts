import type { Meta, StoryObj } from '@storybook/vue3-vite';

import Button from '@/components/Button.vue';

import ReviewDialogFrame from './ReviewDialogFrame.vue';

const meta = {
    component: ReviewDialogFrame,
    args: { open: true, title: 'Submit your review of #1202', width: 600 },
    render: args => ({
        components: { Button, ReviewDialogFrame },
        setup: () => ({ args }),
        template: `
            <ReviewDialogFrame v-bind="args">
                <p>What the dialog says.</p>
                <template #footer><Button size="sm" variant="light">Submit review</Button></template>
            </ReviewDialogFrame>
        `,
    }),
} satisfies Meta<typeof ReviewDialogFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR39, CR75: the title and Esc above, what it says, its buttons along the bottom. */
export const Default: Story = {};
