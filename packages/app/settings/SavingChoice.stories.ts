import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import SavingChoice from './SavingChoice.vue';

const meta = {
    component: SavingChoice,
    args: { modelValue: false, 'onUpdate:modelValue': fn() },
    decorators: [() => ({ template: '<div style="max-width: 648px; padding: 24px"><story /></div>' })],
} satisfies Meta<typeof SavingChoice>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T3, G2: off, the default, and what ticking it does. */
export const Off: Story = {};

/** T6: ticked, a repository found. */
export const Ticked: Story = { args: { modelValue: true } };

/** Ticked, GitHub being asked: still until it answers. */
export const Busy: Story = { args: { modelValue: true, busy: true } };
