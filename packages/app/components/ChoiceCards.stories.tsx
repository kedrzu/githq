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

/** `rows`: one above the other, each a card of its own. */
export const Rows: Story = {
    render: () =>
        defineComponent({
            setup() {
                const density = ref<'comfortable' | 'compact'>('comfortable');

                return () => (
                    <StoryPage>
                        <StorySection title="Density">
                            <h3 id="density-rows-title">Row density</h3>
                            <div style={{ width: '560px' }}>
                                <ChoiceCards
                                    modelValue={density.value}
                                    onUpdate:modelValue={value => (density.value = value)}
                                    rows
                                    labelledby="density-rows-title"
                                    options={[
                                        { value: 'comfortable', label: 'Comfortable', detail: 'Two lines to a row.' },
                                        { value: 'compact', label: 'Compact', detail: 'One line, with its facts.' },
                                    ]}
                                />
                            </div>
                        </StorySection>
                    </StoryPage>
                );
            },
        }),
};

/** `touch`: plain rows a finger's height, as a phone's Code review (mobile MB159). */
export const Touch: Story = {
    render: () =>
        defineComponent({
            setup() {
                const choice = ref<'single' | 'draft'>('single');

                return () => (
                    <div style={{ width: '390px' }}>
                        <h3 id="choice-touch-title">Comments</h3>
                        <ChoiceCards
                            modelValue={choice.value}
                            onUpdate:modelValue={value => (choice.value = value)}
                            touch
                            labelledby="choice-touch-title"
                            options={[
                                {
                                    value: 'single',
                                    label: 'Send it at once',
                                    detail: 'Each comment goes out on its own.',
                                },
                                {
                                    value: 'draft',
                                    label: 'Add it to a draft review',
                                    detail: 'Comments collect in a draft.',
                                },
                            ]}
                        />
                    </div>
                );
            },
        }),
};

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
