import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import PhonePartChip from './PhonePartChip.vue';

const meta = {
    component: PhonePartChip,
    args: { part: { label: 'Issues', count: 142 } },
    // In a line as wide as a phone's command line, which it takes at most half of.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () =>
                    h('div', { style: { display: 'flex', width: '366px', padding: '12px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof PhonePartChip>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A part with its count (mobile MB32). */
export const Default: Story = {};

/** A project view changed on this device (mobile MB222, D49): the dot. */
export const Changed: Story = { args: { part: { label: 'Current sprint', count: 34, changed: true } } };

/** Its count still arriving. */
export const Counting: Story = { args: { part: { label: 'Pull requests', count: null } } };
