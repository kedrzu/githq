import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import Stepper from './Stepper.vue';

const STEPS = ['Sign in', 'Choose what to track', 'First download'];

const meta = {
    component: Stepper,
    args: { steps: STEPS, current: 1, label: 'Getting started' },
} satisfies Meta<typeof Stepper>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The first sign-in's steps, on each of its screens. */
export const Gallery: Story = {
    render: () => (
        <StoryPage>
            {STEPS.map((step, index) => (
                <StorySection title={step}>
                    <Stepper
                        steps={STEPS}
                        current={index}
                        label="Getting started"
                    />
                </StorySection>
            ))}
        </StoryPage>
    ),
};
