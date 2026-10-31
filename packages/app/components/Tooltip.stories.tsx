import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { StoryPage } from '@/.storybook/StoryLayout.jsx';

import Tooltip from './Tooltip.vue';

const meta = {
    component: Tooltip,
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The status bar's short allowance under the rail, with the whole sentence on hover. */
export const ShortStatus: Story = {
    render: () => (
        <StoryPage>
            <Tooltip
                text="4,812 of 5,000 left this hour"
                side="top"
            >
                <span style={{ fontSize: '11.5px', color: '#838992' }}>4.8k</span>
            </Tooltip>
        </StoryPage>
    ),
};
