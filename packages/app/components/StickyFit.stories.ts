import type { Meta, StoryObj } from '@storybook/vue3-vite';

import StickyFit from './StickyFit.vue';

const meta = {
    component: StickyFit,
} satisfies Meta<typeof StickyFit>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Shorter than its 300px scroller: it stays at the top while the long column beside it scrolls. */
export const Short: Story = {
    render: () => renderInScroller(120),
};

/** Taller than its scroller: it scrolls with the long column until its bottom meets the scroller's, then stays. */
export const Tall: Story = {
    render: () => renderInScroller(600),
};

/**
 * A 300px scroller holding two columns as tall as the longer one, as the item view's do: the sticky content in a
 * column of its own, as a flex child that does not grow, and a 2000px column beside it to scroll.
 */
function renderInScroller(height: number) {
    return {
        components: { StickyFit },
        setup: () => ({ height }),
        template: `
            <div
                tid="scroller"
                role="region"
                aria-label="Scroller"
                tabindex="0"
                style="height: 300px; width: 480px; overflow-y: auto"
            >
                <div style="display: flex; gap: 16px">
                    <div style="display: flex; flex-direction: column; width: 200px">
                        <StickyFit>
                            <div
                                tid="content"
                                :style="{ height: height + 'px', border: '1px solid var(--color-border)' }"
                            >
                                Sticky content
                            </div>
                        </StickyFit>
                    </div>
                    <div style="height: 2000px; flex: 1; border: 1px solid var(--color-border)">Long column</div>
                </div>
            </div>
        `,
    };
}
