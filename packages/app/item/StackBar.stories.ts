import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { GLYPHS_STACK, sampleStackDescription, SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';

import StackBar from './StackBar.vue';

const meta = {
    component: StackBar,
    args: {
        stack: sampleStackDescription(SYNC_ENGINE_STACK),
        currentId: SYNC_ENGINE_STACK[5]!.id,
        rowsInView: true,
        dropped: false,
        onOpen: fn(),
        'onUpdate:dropped': fn(),
    },
    // As wide as the panel.
    render: args => ({
        components: { StackBar },
        setup: () => ({ args }),
        template: `<div style="display: flex; flex-direction: column; width: 560px; background: #151b23"><StackBar v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof StackBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The bar's toggle, named by the stack; the translation binds "of" to the word after it with a no-break space. */
const TOGGLE = /^Pull requests of\sthe stack: /;

/** SP82: at the top, the rows in view under it — the name and the squares, no chevron, nothing to drop. */
export const RowsInView: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const toggle = canvas.getByRole('button', { name: TOGGLE });
        await expect(toggle).toBeDisabled();
        await expect(toggle.querySelector('svg.lucide-chevron-down')).toBeNull();
    },
};

/**
 * SP83: the rows scrolled away — the chevron right after the name; a click anywhere on the bar but the squares drops the
 * rows, a square opens its pull request.
 */
export const RowsAway: Story = {
    args: { rowsInView: false },
    play: async ({ args, canvasElement }) => {
        const canvas = within(canvasElement);
        const toggle = canvas.getByRole('button', { name: TOGGLE });
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toggle.querySelector('svg.lucide-chevron-down')).not.toBeNull();
        // No button in a button: the squares are the toggle's sibling.
        const places = canvas.getByRole('list');
        await expect(toggle.contains(places)).toBe(false);

        await userEvent.click(toggle);
        await expect(args['onUpdate:dropped']).toHaveBeenCalledWith(true);

        await userEvent.click(canvas.getByRole('button', { name: /^7: / }));
        await expect(args.onOpen).toHaveBeenCalledWith(SYNC_ENGINE_STACK[6]!.id);
        await expect(args['onUpdate:dropped']).toHaveBeenCalledTimes(1);
    },
};

/** SP84: the rows dropped over the content — the chevron turned up; a second click takes them away. */
export const Dropped: Story = {
    args: { rowsInView: false, dropped: true },
    play: async ({ args, canvasElement }) => {
        const toggle = within(canvasElement).getByRole('button', { name: TOGGLE });
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(toggle.querySelector('svg.lucide-chevron-up')).not.toBeNull();
        await userEvent.click(toggle);
        await expect(args['onUpdate:dropped']).toHaveBeenCalledWith(false);
    },
};

/** SP30: a stack of two — two squares. */
export const StackOfTwo: Story = {
    args: { stack: sampleStackDescription(GLYPHS_STACK), currentId: GLYPHS_STACK[1]!.id },
};
