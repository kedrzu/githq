import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import HostSwapLoop from './HostSwapLoop.vue';

// The address bar the hero draws around the loop (githq.pen "Landing — motion storyboard"): its parts are the bar's
// flex items.
const inAddressBar: Decorator = story => {
    const Story = story();
    return defineComponent({
        setup: () => () =>
            h(
                'p',
                {
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        width: '264px',
                        padding: '10px 12px',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '12px',
                        lineHeight: '16px',
                        color: '#e4e6ea',
                        whiteSpace: 'nowrap',
                        background: '#0e1013',
                        border: '1px solid #2e333b',
                        borderRadius: '8px',
                    },
                },
                [h(Story)],
            ),
    });
};

const meta = {
    component: HostSwapLoop,
    decorators: [inAddressBar],
    args: { step: 'githq', host: 'githq.dev' },
} satisfies Meta<typeof HostSwapLoop>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 4 — entered: githq's address, where the loop rests and what the prerendered page shows. */
export const Githq: Story = {};

/** 1 — a GitHub address, the caret blinking after the host. */
export const Github: Story = { args: { step: 'github', host: 'github.com' } };

/** 2 — the host highlighted, as if double-clicked. */
export const Selected: Story = { args: { step: 'selected', host: 'github.com' } };

/** 3 — githq's host typing in, the caret after it. */
export const Typing: Story = { args: { step: 'typing', host: 'githq.d' } };
