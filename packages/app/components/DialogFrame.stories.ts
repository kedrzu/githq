import type { Meta, StoryObj } from '@storybook/vue3-vite';

import Button from './Button.vue';
import DialogFrame from './DialogFrame.vue';

const meta = {
    component: DialogFrame,
    args: { open: true, title: 'Submit your review of #1202', width: 600 },
    render: args => ({
        components: { Button, DialogFrame },
        setup: () => ({ args }),
        template: `
            <DialogFrame v-bind="args">
                <p>What the dialog says.</p>
                <template #footer><Button size="sm" variant="light">Submit review</Button></template>
            </DialogFrame>
        `,
    }),
} satisfies Meta<typeof DialogFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

/** CR39, CR75: the title and Esc above, what it says, its buttons along the bottom. */
export const Default: Story = {};
