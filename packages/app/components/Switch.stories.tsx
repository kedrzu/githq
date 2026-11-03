import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import Switch from './Switch.vue';

const meta = {
    component: Switch,
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Switch` and `Switch / on`: the default branch's alerts, flipped by a click. */
export const Gallery: Story = {
    args: { label: 'Default branch', modelValue: true },
    render: () =>
        defineComponent({
            setup() {
                const on = ref(true);

                return () => (
                    <StoryPage>
                        <StorySection title="On and off">
                            <Switch
                                label="Default branch"
                                modelValue={on.value}
                                onUpdate:modelValue={value => (on.value = value)}
                            />
                            <Switch
                                label="Off"
                                modelValue={false}
                            />
                        </StorySection>
                    </StoryPage>
                );
            },
        }),
};
