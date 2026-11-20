import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';

import { withMotion } from '@/testing/withMotion.js';

import Button from './Button.vue';
import MotionList from './MotionList.vue';

const meta = {
    component: MotionList,
    render: () => ({
        components: { Button, MotionList },
        setup() {
            const next = ref(4);
            const items = ref([1, 2, 3]);
            return { items, add, remove };

            function add() {
                items.value = [next.value++, ...items.value];
            }

            function remove() {
                items.value = items.value.slice(1);
            }
        },
        template: `
            <div style="display: flex; gap: 8px">
                <Button variant="secondary" @click="add">Add on top</Button>
                <Button variant="secondary" @click="remove">Remove the first</Button>
            </div>
            <MotionList tid="items" style="width: 320px; padding: 0; list-style: none">
                <li v-for="item in items" :key="item" style="padding: 6px 8px">Item {{ item }}</li>
            </MotionList>
        `,
    }),
} satisfies Meta<typeof MotionList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The animations off, as anywhere outside the shell: items come and go at once. */
export const Still: Story = {};

/** The animations on: an item comes fading in, goes fading out, and the rest slide into place. */
export const Animated: Story = {
    decorators: [withMotion],
};
