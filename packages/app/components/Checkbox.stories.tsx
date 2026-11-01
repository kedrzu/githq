import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import Checkbox from './Checkbox.vue';

const meta = {
    component: Checkbox,
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The tracking list's repositories, a partly chosen owner, and "Create another". */
export const Gallery: Story = {
    render: () =>
        defineComponent({
            setup() {
                const githq = ref(true);
                const mobile = ref(false);
                const another = ref(false);

                return () => (
                    <StoryPage>
                        <StorySection title="Repositories">
                            <Checkbox
                                modelValue={githq.value}
                                onUpdate:modelValue={value => (githq.value = value)}
                            >
                                kedrzu/<strong>githq</strong>
                            </Checkbox>
                            <Checkbox
                                modelValue={mobile.value}
                                onUpdate:modelValue={value => (mobile.value = value)}
                                label="skyline-labs/mobile"
                            />
                            <Checkbox
                                modelValue={false}
                                indeterminate
                                label="skyline-labs · 2 of 312"
                            />
                            <Checkbox
                                modelValue={false}
                                disabled
                                label="acme-health/portal"
                            />
                        </StorySection>
                        <StorySection title="Quick capture">
                            <Checkbox
                                modelValue={another.value}
                                onUpdate:modelValue={value => (another.value = value)}
                                label="Create another"
                            />
                            <span tid="another">Create another: {String(another.value)}</span>
                        </StorySection>
                    </StoryPage>
                );
            },
        }),
};
