import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { withPhoneLayout } from '@/testing/withPhoneLayout.js';

import ExternalMark from './ExternalMark.vue';

const meta = {
    component: ExternalMark,
    // After a commit's hash, as the thread links it.
    render: () => ({
        components: { ExternalMark },
        template: `<a href="https://github.com/acme/web/commit/a3f91c2" style="color: #8b8cf8; font-family: monospace">a3f91c2<ExternalMark /></a>`,
    }),
} satisfies Meta<typeof ExternalMark>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Mobile D11: on a phone the link ends in ↗ and its name says it opens on github.com. */
export const OnPhone: Story = { decorators: [withPhoneLayout(true)] };

/** On the computer nothing: the link is as it always was. */
export const OnComputer: Story = { decorators: [withPhoneLayout(false)] };
