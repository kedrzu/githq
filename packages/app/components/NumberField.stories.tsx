import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import NumberField from './NumberField.vue';

const meta = {
    component: NumberField,
} satisfies Meta<typeof NumberField>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A project's number field, bound by `v-model`: emptied, it holds nothing. */
export const Estimate: Story = {
    render: () =>
        defineComponent({
            setup() {
                const estimate = ref<number | null | undefined>(3);

                return () => (
                    <StoryPage>
                        <StorySection title="With a hint">
                            <div style={{ width: '240px' }}>
                                <NumberField
                                    modelValue={estimate.value}
                                    onUpdate:modelValue={value => (estimate.value = value)}
                                    label="Estimate"
                                    placeholder="Empty clears it"
                                    info="In points."
                                />
                            </div>
                        </StorySection>
                        <p tid="value">Value: {estimate.value == null ? 'none' : String(estimate.value)}</p>
                    </StoryPage>
                );
            },
        }),
};
