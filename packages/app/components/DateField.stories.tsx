import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import DateField from './DateField.vue';

const meta = {
    component: DateField,
} satisfies Meta<typeof DateField>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A project's date field, bound by `v-model` to the local midnight of the day picked. */
export const DueDate: Story = {
    render: () =>
        defineComponent({
            setup() {
                const due = ref<Date | null | undefined>(new Date(2026, 10, 3));

                return () => (
                    <StoryPage>
                        <StorySection title="With a hint">
                            <div style={{ width: '240px' }}>
                                <DateField
                                    modelValue={due.value}
                                    onUpdate:modelValue={value => (due.value = value)}
                                    label="Due"
                                    info="When it ships."
                                />
                            </div>
                        </StorySection>
                        <p tid="value">
                            Value:{' '}
                            {due.value
                                ? `${due.value.getFullYear()}-${due.value.getMonth() + 1}-${due.value.getDate()} ${due.value.getHours()}h`
                                : 'none'}
                        </p>
                    </StoryPage>
                );
            },
        }),
};
