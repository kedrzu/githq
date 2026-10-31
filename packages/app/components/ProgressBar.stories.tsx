import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import ProgressBar from './ProgressBar.vue';

const meta = {
    component: ProgressBar,
    args: { value: 0.62, label: 'sigma-clinic/portal' },
} satisfies Meta<typeof ProgressBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Not known yet, going on, and done. */
export const Gallery: Story = {
    render: () => (
        <StoryPage>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '140px' }}>
                <StorySection title="Not known yet">
                    <ProgressBar
                        value={null}
                        label="sigma-clinic/api"
                    />
                </StorySection>
                <StorySection title="Going on">
                    <ProgressBar
                        value={0.62}
                        label="sigma-clinic/portal"
                    />
                </StorySection>
                <StorySection title="Done">
                    <ProgressBar
                        value={1}
                        label="kedrzu/githq"
                    />
                </StorySection>
            </div>
        </StoryPage>
    ),
};
