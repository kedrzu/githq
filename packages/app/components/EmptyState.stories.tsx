import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { CircleCheckBig, Coffee, Hourglass } from 'lucide-vue-next';

import Button from './Button.vue';
import EmptyState from './EmptyState.vue';

const meta = {
    component: EmptyState,
    args: {
        icon: CircleCheckBig,
        tone: 'good',
        title: 'Nothing on your plate',
        detail: 'No review requests, open pull requests, assigned issues or mentions, anywhere on GitHub.',
    },
    render: args => ({
        setup: () => () => (
            <div style={{ display: 'flex', height: '100vh' }}>
                <EmptyState {...args} />
            </div>
        ),
    }),
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

/** K4: empty is good news. */
export const Good: Story = {};

/** K5: just nothing here, with a way on. */
export const WithAction: Story = {
    args: {
        icon: Coffee,
        tone: 'calm',
        title: 'Nothing needs you right now',
        detail: 'No review requests, no assigned issues, and none of your pull requests are failing, blocked or asked to change.',
    },
    render: args => ({
        setup: () => () => (
            <div style={{ display: 'flex', height: '100vh' }}>
                <EmptyState {...args}>
                    {{
                        action: () => (
                            <Button
                                variant="outline"
                                icon={Hourglass}
                                kbd="3"
                            >
                                2 of your pull requests are waiting on others
                            </Button>
                        ),
                    }}
                </EmptyState>
            </div>
        ),
    }),
};
