import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { defineComponent, h } from 'vue';

import PhoneBackButton from './PhoneBackButton.vue';
import PhoneTopBar from './PhoneTopBar.vue';

const meta = {
    component: PhoneBackButton,
    args: { onClick: fn() },
    // In a phone's top bar, as wide as a phone.
    decorators: [
        story => {
            const Story = story();
            return defineComponent({
                setup: () => () =>
                    h('div', { style: { width: '390px' } }, [h(PhoneTopBar, null, { start: () => h(Story) })]),
            });
        },
    ],
} satisfies Meta<typeof PhoneBackButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Back to the list an item was opened from (mobile MB33). */
export const ToList: Story = { args: { place: 'Issues' } };

/** Opened from a link, back goes up to the repository (mobile MB62). */
export const ToRepository: Story = { args: { place: 'fitloop/webapp' } };

/** A long name is cut to the room the bar leaves. */
export const LongPlace: Story = { args: { place: 'skyline-labs/a-repository-with-a-very-long-name-indeed' } };

/** Nowhere named yet. */
export const Unnamed: Story = { args: { place: null } };
