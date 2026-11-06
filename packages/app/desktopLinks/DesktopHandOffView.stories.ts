import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';

import DesktopHandOffView from './DesktopHandOffView.vue';

const meta = {
    component: DesktopHandOffView,
    args: { onOpenHere: fn(), onTurnOff: fn() },
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DesktopHandOffView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A link was handed to the desktop app: the browser can stay, or stop doing this. */
export const HandedOff: Story = {};
