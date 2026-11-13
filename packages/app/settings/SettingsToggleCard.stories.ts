import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import SettingsToggleCard from './SettingsToggleCard.vue';

const meta = {
    component: SettingsToggleCard,
    args: {
        title: 'Setting',
        description: 'What it does.',
        modelValue: true,
        'onUpdate:modelValue': fn(),
    },
    decorators: [() => ({ template: '<div style="max-width: 560px; padding: 24px"><story /></div>' })],
} satisfies Meta<typeof SettingsToggleCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Settings / Toggle card`: on. */
export const On: Story = {};

/** `Settings / Toggle card · off`. */
export const Off: Story = { args: { modelValue: false } };

/** `Settings / Toggle card · with link`: a page saying more, under the text. */
export const WithLink: Story = {
    args: { link: { label: 'Learn more', href: '/docs/' } },
};

/** A long description wraps beside the Switch, which stays on the title's line. */
export const LongDescription: Story = {
    args: {
        description:
            'Short fades and slides show where a menu or window comes from, so the screen does not jump. Turn them off and everything appears at once.',
    },
    decorators: [() => ({ template: '<div style="width: 360px"><story /></div>' })],
};
