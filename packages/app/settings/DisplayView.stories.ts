import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import { withPhoneLayout } from '@/testing/withPhoneLayout.js';
import { readTypography } from '@/typography/readTypography.js';

import DisplayView from './DisplayView.vue';
import { EMPTY_SETTINGS_DOCUMENT } from './sync/SettingsDocument.js';

const meta = {
    component: DisplayView,
    args: {
        animations: true,
        'onUpdate:animations': fn(),
        typography: readTypography(EMPTY_SETTINGS_DOCUMENT),
        onTypographyPreset: fn(),
        onTypographyChange: fn(),
    },
    // The story frame is narrower than a phone's: the computer's menus, but where a story says otherwise.
    decorators: [withPhoneLayout(false)],
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DisplayView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T28, CH49: the typography on its defaults, animations turned on. */
export const AnimationsOn: Story = {};

/** CH49: animations turned off. */
export const AnimationsOff: Story = { args: { animations: false } };

/** A narrow window. */
export const NarrowWindow: Story = {
    decorators: [() => ({ template: '<div style="width: 480px"><story /></div>' })],
};

/** MB158: on a phone, whether things animate alone, a switch row under Motion; no typography. */
export const Phone: Story = { args: { phone: true }, decorators: [withPhoneLayout(true)] };
