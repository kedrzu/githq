import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import LabelPill from './LabelPill.vue';
import PropertyRow from './PropertyRow.vue';

const meta: Meta<typeof PropertyRow> = {
    component: PropertyRow,
};

export default meta;

type Story = StoryObj<typeof PropertyRow>;

/** An item's properties with the keys that edit them, and a project card's fields. */
export const Gallery: Story = {
    render: () => (
        <StoryPage>
            <StorySection title="Properties">
                <dl style={{ display: 'flex', flexDirection: 'column', gap: '9px', width: '512px' }}>
                    <PropertyRow
                        label="Labels"
                        kbd="L"
                    >
                        <LabelPill
                            name="bug"
                            color="e5534b"
                        />
                        <LabelPill
                            name="calendar"
                            color="4fb0c6"
                        />
                    </PropertyRow>
                    <PropertyRow
                        label="Milestone"
                        kbd="M"
                    >
                        v4.2 — November
                    </PropertyRow>
                </dl>
            </StorySection>
            <StorySection title="In a project's card">
                <dl style={{ display: 'flex', flexDirection: 'column', gap: '7px', width: '488px' }}>
                    <PropertyRow
                        label="Priority"
                        size="card"
                        kbd="P"
                    >
                        High
                    </PropertyRow>
                    <PropertyRow
                        label="Estimate"
                        size="card"
                    >
                        3
                    </PropertyRow>
                </dl>
            </StorySection>
        </StoryPage>
    ),
};
