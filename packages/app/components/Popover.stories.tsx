import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Tag } from 'lucide-vue-next';
import { defineComponent, ref } from 'vue';

import { StoryPage } from '@/.storybook/StoryLayout.jsx';

import Button from './Button.vue';
import Checkbox from './Checkbox.vue';
import Popover from './Popover.vue';

const meta: Meta<typeof Popover> = {
    component: Popover,
};

export default meta;

type Story = StoryObj<typeof Popover>;

/** A property's picker hangs from its chip: here the labels. */
export const LabelsPicker: Story = {
    render: () =>
        defineComponent({
            setup() {
                const bug = ref(true);
                const calendar = ref(false);

                return () => (
                    <StoryPage>
                        <Popover label="Labels">
                            {{
                                trigger: () => (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        icon={Tag}
                                    >
                                        Labels
                                    </Button>
                                ),
                                default: () => (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <Checkbox
                                            modelValue={bug.value}
                                            onUpdate:modelValue={value => (bug.value = value)}
                                            label="bug"
                                        />
                                        <Checkbox
                                            modelValue={calendar.value}
                                            onUpdate:modelValue={value => (calendar.value = value)}
                                            label="calendar"
                                        />
                                    </div>
                                ),
                            }}
                        </Popover>
                    </StoryPage>
                );
            },
        }),
};
