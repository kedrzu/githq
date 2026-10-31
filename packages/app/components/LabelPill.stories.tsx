import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { StoryPage, StoryRow } from '@/.storybook/StoryLayout.jsx';

import LabelPill from './LabelPill.vue';

const meta: Meta<typeof LabelPill> = {
    component: LabelPill,
};

export default meta;

type Story = StoryObj<typeof LabelPill>;

/** GitHub's default labels and a dark one: the dot carries the colour, the text stays readable. */
export const Gallery: Story = {
    render: () => (
        <StoryPage>
            <StoryRow>
                <LabelPill
                    name="bug"
                    color="d73a4a"
                />
                <LabelPill
                    name="feature"
                    color="a2eeef"
                />
                <LabelPill
                    name="docs"
                    color="0075ca"
                />
                <LabelPill
                    name="perf"
                    color="d6a23a"
                />
                <LabelPill
                    name="blocked"
                    color="000000"
                />
            </StoryRow>
        </StoryPage>
    ),
};
