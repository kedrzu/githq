import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, userEvent, within } from 'storybook/test';
import { defineComponent, ref } from 'vue';

import RadioCards from './RadioCards.vue';

const OPTIONS = [{ value: 'one' }, { value: 'two' }, { value: 'three' }];

// No `component`: Storybook's types can't take a generic component; the stories render it themselves.
const meta = {
    render: () =>
        defineComponent({
            setup() {
                const chosen = ref('one');

                return () => (
                    <>
                        <style>{'[role="radio"] { color: inherit; background: none; border: 1px solid; }'}</style>
                        <RadioCards
                            modelValue={chosen.value}
                            onUpdate:modelValue={value => (chosen.value = value)}
                            options={OPTIONS}
                            aria-label="A number"
                            style={{ display: 'flex', gap: '8px' }}
                        >
                            {{ default: ({ option }: { option: { value: string } }) => option.value }}
                        </RadioCards>
                    </>
                );
            },
        }),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** Tab reaches the chosen card. */
export const Chosen: Story = {};

/** A quick press of an arrow moves and chooses. */
export const ArrowChooses: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.tab();
        await userEvent.keyboard('{ArrowRight}');
        await expect(canvas.getByRole('radio', { name: 'two' })).toBeChecked();
    },
};
