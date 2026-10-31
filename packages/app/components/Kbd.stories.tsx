import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { StoryPage, StoryRow, StorySection } from '@/.storybook/StoryLayout.jsx';

import Kbd from './Kbd.vue';

const meta = {
    component: Kbd,
    args: { keys: '⌘K' },
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The hints of the mockups: on the window, every glyph drawn as an icon, on a filled button, and the small one of a row. */
export const Gallery: Story = {
    render: () => (
        <StoryPage>
            <StorySection title="Default">
                <StoryRow>
                    <Kbd keys="⌘K" />
                    <Kbd keys="A" />
                    <Kbd keys="⌥L" />
                    <Kbd keys="⌘↵" />
                </StoryRow>
            </StorySection>
            <StorySection title="Every key drawn as an icon">
                <StoryRow>
                    {['⌘', '⇧', '⌥', '⌃', '↵', '⌫', '⇥', '↑', '↓', '←', '→'].map(keys => (
                        <Kbd
                            key={keys}
                            keys={keys}
                        />
                    ))}
                </StoryRow>
                <StoryRow>
                    <Kbd keys="⇧O" />
                    <Kbd keys="⌃⌥⇧⌘K" />
                    <Kbd keys="↑↓" />
                    <Kbd keys="Esc" />
                    <Kbd keys="Space" />
                </StoryRow>
            </StorySection>
            <StorySection title="On a filled button">
                <StoryRow>
                    <span style={{ padding: '6px 12px', background: '#7b87f7', borderRadius: '7px' }}>
                        <Kbd
                            tone="onFill"
                            keys="⌘↵"
                        />
                    </span>
                    <span style={{ padding: '6px 12px', background: '#e4e6ea', borderRadius: '7px' }}>
                        <Kbd
                            tone="onFill"
                            keys="↵"
                        />
                    </span>
                </StoryRow>
            </StorySection>
            <StorySection title="Small">
                <StoryRow>
                    <Kbd
                        size="sm"
                        keys="O"
                    />
                    <Kbd
                        size="sm"
                        keys="⌘↵"
                    />
                </StoryRow>
            </StorySection>
        </StoryPage>
    ),
};
