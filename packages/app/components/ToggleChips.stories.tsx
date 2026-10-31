import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage, StoryRow } from '@/.storybook/StoryLayout.jsx';

import ToggleChips from './ToggleChips.vue';

// No `component`: Storybook's types can't take a generic component; the stories render it themselves.
const meta = {} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** D4: the properties a list's rows show, some on. */
export const Properties: Story = {
    render: () =>
        defineComponent({
            setup() {
                const shown = ref<readonly string[]>(['repo', 'labels']);
                const options = ['repo', 'priority', 'estimate', 'labels', 'iteration'].map(value => ({
                    value,
                    label: value[0]?.toUpperCase() + value.slice(1),
                }));

                return () => (
                    <StoryPage>
                        <StoryRow>
                            <ToggleChips
                                label="Properties"
                                options={options}
                                modelValue={shown.value}
                                onUpdate:modelValue={(value: readonly string[]) => (shown.value = value)}
                            />
                        </StoryRow>
                        <span tid="shown">{shown.value.join(' ')}</span>
                    </StoryPage>
                );
            },
        }),
};
