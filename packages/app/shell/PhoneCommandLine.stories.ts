import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h } from 'vue';

import PhoneCommandLine from './PhoneCommandLine.vue';

const meta = {
    component: PhoneCommandLine,
    args: { variant: 'list', onMenu: fn(), onComment: fn() },
    // Floating over the bottom of a phone's screen, as in the app.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () => h('div', { style: { width: '366px', padding: '12px' } }, [h(Story)]),
            });
        },
    ],
} satisfies Meta<typeof PhoneCommandLine>;

export default meta;

type Story = StoryObj<typeof meta>;

/** On a list (mobile MB32): ⌘, the part shown with its count, "Do or find…". */
export const List: Story = { args: { part: { label: 'Issues', count: 142 } } };

/** On a list whose part has no count yet. */
export const ListCounting: Story = { args: { part: { label: 'Pull requests', count: null } } };

/** On a screen that names no part (Settings). */
export const ListNoPart: Story = {};

/** On an item's page (mobile MB33): the comment box's pill and the round ⌘. */
export const Item: Story = { args: { variant: 'item' } };
