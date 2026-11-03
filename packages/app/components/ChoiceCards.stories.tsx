import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import Button from './Button.vue';
import type { ChoiceCardsOption } from './ChoiceCards.vue';
import ChoiceCards from './ChoiceCards.vue';

// No `component`: Storybook's types can't take a generic component; the stories render it themselves.
const meta = {} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** Three cards, the caller drawing a part of each; the button changes the choice as another tab or device would. */
export const Gallery: Story = {
    render: () =>
        defineComponent({
            setup() {
                const density = ref<'comfortable' | 'compact' | 'dense'>('comfortable');

                return () => (
                    <StoryPage>
                        <StorySection title="Density">
                            <h3 id="density-title">Row density</h3>
                            <div style={{ width: '560px' }}>
                                <ChoiceCards
                                    modelValue={density.value}
                                    onUpdate:modelValue={value => (density.value = value)}
                                    labelledby="density-title"
                                    options={[
                                        { value: 'comfortable', label: 'Comfortable', detail: 'Two lines to a row.' },
                                        { value: 'compact', label: 'Compact', detail: 'One line, with its facts.' },
                                        { value: 'dense', label: 'Dense', detail: 'One line, the title alone.' },
                                    ]}
                                >
                                    {{
                                        default: ({ option }: { option: ChoiceCardsOption<string> }) => (
                                            <b>{option.label[0]}</b>
                                        ),
                                    }}
                                </ChoiceCards>
                            </div>
                            <span tid="density">Density: {density.value}</span>
                            <Button
                                variant="outline"
                                onClick={() => (density.value = 'dense')}
                            >
                                Chosen in another tab
                            </Button>
                        </StorySection>
                    </StoryPage>
                );
            },
        }),
};
