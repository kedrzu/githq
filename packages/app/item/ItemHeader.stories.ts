import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Maximize2, Minimize2 } from 'lucide-vue-next';
import { expect, fn, userEvent, within } from 'storybook/test';

import ItemHeader from './ItemHeader.vue';

const meta = {
    component: ItemHeader,
    args: {
        position: { index: 3, count: 13 },
        otherArrangement: { arrangement: 'page', title: 'Open full screen', icon: Maximize2 },
        url: 'https://github.com/skyline-labs/portal/issues/1187',
        stepKeys: { previous: 'K', next: 'J' },
        onPrevious: fn(),
        onNext: fn(),
        onArrange: fn(),
        onClose: fn(),
    },
    // As wide as the panel, a plain identity in the slot.
    render: args => ({
        components: { ItemHeader },
        setup: () => ({ args }),
        template: `<div style="display: flex; flex-direction: column; width: 560px; background: #151b23">
            <ItemHeader v-bind="args"><template #identity><span>skyline-labs/portal #1187</span></template></ItemHeader>
        </div>`,
    }),
} satisfies Meta<typeof ItemHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

/** In the panel: `K`/`J` and the place, "Open full screen", GitHub and close; each button reports its move. */
export const InPanel: Story = {
    play: async ({ args, canvasElement }) => {
        const canvas = within(canvasElement);
        // The translation binds "on" to the word after it with a no-break space.
        await expect(canvas.getByRole('link', { name: /^Open on\sGitHub$/u })).toHaveAttribute(
            'href',
            'https://github.com/skyline-labs/portal/issues/1187',
        );
        await userEvent.click(canvas.getByRole('button', { name: 'Previous item' }));
        await userEvent.click(canvas.getByRole('button', { name: 'Next item' }));
        await userEvent.click(canvas.getByRole('button', { name: 'Open full screen' }));
        await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
        await expect(args.onPrevious).toHaveBeenCalledTimes(1);
        await expect(args.onNext).toHaveBeenCalledTimes(1);
        await expect(args.onArrange).toHaveBeenCalledWith('page');
        await expect(args.onClose).toHaveBeenCalledTimes(1);
    },
};

/** On a page: "Back to the panel"; at the list's last item, no next step. */
export const OnPageAtTheEnd: Story = {
    args: {
        position: { index: 13, count: 13 },
        otherArrangement: { arrangement: 'panel', title: 'Back to the panel', icon: Minimize2 },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('button', { name: 'Next item' })).toBeDisabled();
        await expect(canvas.getByRole('button', { name: 'Back to the panel' })).toBeVisible();
    },
};

/** Not opened from a list, on a page with no room for the panel: no stepper, no other arrangement. */
export const Alone: Story = {
    args: { position: null, otherArrangement: null },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.queryByRole('button', { name: 'Next item' })).toBeNull();
        await expect(canvas.queryByRole('button', { name: 'Back to the panel' })).toBeNull();
    },
};

/** W30: a workflow steps by `⇧K`/`⇧J`, drawn as two keycaps and named so to assistive technology. */
export const ShiftStepKeys: Story = {
    args: { stepKeys: { previous: 'Shift+K', next: 'Shift+J' } },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('button', { name: 'Next item' })).toHaveAttribute('aria-keyshortcuts', 'Shift+J');
    },
};
