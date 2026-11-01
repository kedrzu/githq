import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { StoryPage, StoryRow, StorySection } from '@/.storybook/StoryLayout.jsx';

import Sygnet from './Sygnet.vue';

const meta = {
    component: Sygnet,
} satisfies Meta<typeof Sygnet>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The sygnet at its own size and at the landing page's final call to action. */
export const Gallery: Story = {
    render: () => (
        <StoryPage>
            <StorySection title="Sizes">
                <StoryRow>
                    <Sygnet />
                    <Sygnet style={{ '--sygnet-size': '64px' }} />
                </StoryRow>
            </StorySection>
        </StoryPage>
    ),
};
