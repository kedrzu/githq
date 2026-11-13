import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { ref } from 'vue';

import WidthHandle from './WidthHandle.vue';

const meta = {
    component: WidthHandle,
    // `side` only for the type: a centred box has a handle on each edge, both drawn.
    args: { label: 'Resize the item', side: 'right', min: 400, max: 1000, modelValue: 600, onResized: fn() },
    render: args => ({
        components: { WidthHandle },
        setup: () => ({ args, width: ref(args.modelValue ?? 0) }),
        template: `
            <div style="width: 1000px">
                <div
                    tid="box"
                    :style="{
                        position: 'relative',
                        width: 'min(' + width + 'px, 100%)',
                        height: '200px',
                        margin: '0 auto',
                        border: '1px solid var(--color-border)',
                    }"
                >
                    <WidthHandle
                        v-for="side in ['left', 'right']"
                        :key="side"
                        v-model="width"
                        :side="side"
                        :label="args.label"
                        :min="args.min"
                        :max="args.max"
                        @resized="args.onResized"
                    />
                </div>
            </div>
        `,
    }),
} satisfies Meta<typeof WidthHandle>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A 600px box centred in 1,000px, a handle on each edge: dragged, both edges move, from 400px up to all of it. */
export const Centred: Story = {};

/** 1,200px kept in 1,000px of room: drawn at all of it, and resized from what is drawn, not what is kept. */
export const Squeezed: Story = {
    args: { modelValue: 1200 },
};
