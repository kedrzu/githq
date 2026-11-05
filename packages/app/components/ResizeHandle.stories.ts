import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { SplitterGroup, SplitterPanel } from 'reka-ui';
import { expect, waitFor, within } from 'storybook/test';
import { defineComponent, h } from 'vue';

import ResizeHandle from './ResizeHandle.vue';

const Split = defineComponent(
    (props: { label: string }) => {
        return () =>
            h(SplitterGroup, { direction: 'horizontal', style: 'height: 100vh' }, () => [
                h(SplitterPanel, { defaultSize: 30 }),
                h(ResizeHandle, { label: props.label }),
                h(SplitterPanel),
            ]);
    },
    { props: ['label'] },
);

const meta = {
    component: ResizeHandle,
    args: { label: 'Resize sidebar' },
    render: args => h(Split, { label: args.label }),
} satisfies Meta<typeof ResizeHandle>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Hovered, the line lights up and the page shows the resize cursor: from the app's stylesheet, not the `<style>` Reka UI adds, which the desktop app's CSP blocks. */
export const Hovered: Story = {
    play: async ({ canvasElement }) => {
        const handle = within(canvasElement).getByRole('separator', { name: 'Resize sidebar' });
        const { left, top, height } = handle.getBoundingClientRect();
        document.body.dispatchEvent(
            new MouseEvent('mousemove', { bubbles: true, clientX: left, clientY: top + height / 2 }),
        );

        await waitFor(() => expect(handle).toHaveAttribute('data-state', 'hover'));
        // Reka UI's own cursor is `ew-resize`.
        await expect(getComputedStyle(document.body).cursor).toBe('col-resize');
    },
};
