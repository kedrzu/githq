import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import LabelPill from './LabelPill.vue';
import PropertyRow from './PropertyRow.vue';
import PropertyValueButton from './PropertyValueButton.vue';

const meta: Meta<typeof PropertyValueButton> = {
    component: PropertyValueButton,
};

export default meta;

type Story = StoryObj<typeof PropertyValueButton>;

/** Values that open their editors: an item's labels and milestone, a project card's status and an empty field. */
export const Gallery: Story = {
    render: () =>
        defineComponent({
            setup() {
                const opened = ref('nothing');

                return () => (
                    <StoryPage>
                        <StorySection title="Properties">
                            <dl style={{ display: 'flex', flexDirection: 'column', gap: '9px', width: '512px' }}>
                                <PropertyRow
                                    label="Labels"
                                    kbd="L"
                                >
                                    <PropertyValueButton
                                        label="Labels: bug, calendar"
                                        keyshortcuts="L"
                                        onClick={() => (opened.value = 'Labels')}
                                    >
                                        <LabelPill
                                            name="bug"
                                            color="e5534b"
                                        />
                                        <LabelPill
                                            name="calendar"
                                            color="4fb0c6"
                                        />
                                    </PropertyValueButton>
                                </PropertyRow>
                                <PropertyRow
                                    label="Milestone"
                                    kbd="M"
                                >
                                    <PropertyValueButton
                                        label="Milestone: none"
                                        keyshortcuts="M"
                                        onClick={() => (opened.value = 'Milestone')}
                                    >
                                        None
                                    </PropertyValueButton>
                                </PropertyRow>
                            </dl>
                        </StorySection>
                        <StorySection title="In a project's card">
                            <dl style={{ display: 'flex', flexDirection: 'column', gap: '7px', width: '488px' }}>
                                <PropertyRow
                                    label="Status"
                                    size="card"
                                    kbd="S"
                                >
                                    <PropertyValueButton
                                        size="card"
                                        label="Status: In progress"
                                        keyshortcuts="S"
                                        onClick={() => (opened.value = 'Status')}
                                    >
                                        In progress
                                    </PropertyValueButton>
                                </PropertyRow>
                                <PropertyRow
                                    label="Estimate"
                                    size="card"
                                >
                                    <PropertyValueButton
                                        size="card"
                                        label="Estimate: empty"
                                        onClick={() => (opened.value = 'Estimate')}
                                    >
                                        Empty
                                    </PropertyValueButton>
                                </PropertyRow>
                            </dl>
                        </StorySection>
                        <p tid="opened">Opened: {opened.value}</p>
                    </StoryPage>
                );
            },
        }),
};
