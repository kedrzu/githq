import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { StoryPage, StoryRow, StorySection } from '@/.storybook/StoryLayout.jsx';

import Kbd from './Kbd.vue';

const meta = {
    component: Kbd,
    args: { keys: 'Mod+K' },
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The hints of the mockups: on the window, every key as this platform writes it (⌘ ⌥ ⇧ on a Mac, Ctrl Alt Shift
 * elsewhere — Storybook shows the machine's), on a filled button, and the small one of a row.
 */
export const Gallery: Story = {
    render: () => (
        <StoryPage>
            <StorySection title="Default">
                <StoryRow>
                    <Kbd keys="Mod+K" />
                    <Kbd keys="A" />
                    <Kbd keys="Alt+L" />
                    <Kbd keys="Mod+Enter" />
                </StoryRow>
            </StorySection>
            <StorySection title="Every key">
                <StoryRow>
                    {[
                        'Mod',
                        'Shift',
                        'Alt',
                        'Control',
                        'Enter',
                        'Backspace',
                        'Tab',
                        'ArrowUp',
                        'ArrowDown',
                        'ArrowLeft',
                        'ArrowRight',
                    ].map(keys => (
                        <Kbd
                            key={keys}
                            keys={keys}
                        />
                    ))}
                </StoryRow>
                <StoryRow>
                    <Kbd keys="Shift+O" />
                    <Kbd keys="Control+Alt+Shift+Mod+K" />
                    <Kbd keys="ArrowUp ArrowDown" />
                    <Kbd keys="Escape" />
                    <Kbd keys="Space" />
                </StoryRow>
            </StorySection>
            <StorySection title="On a filled button">
                <StoryRow>
                    <span style={{ padding: '6px 12px', background: '#7b87f7', borderRadius: '7px' }}>
                        <Kbd
                            tone="onFill"
                            keys="Mod+Enter"
                        />
                    </span>
                    <span style={{ padding: '6px 12px', background: '#e4e6ea', borderRadius: '7px' }}>
                        <Kbd
                            tone="onFill"
                            keys="Enter"
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
                        keys="Mod+Enter"
                    />
                </StoryRow>
            </StorySection>
        </StoryPage>
    ),
};
