import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { StoryPage, StoryRow, StorySection } from '@/.storybook/StoryLayout.jsx';

import Kbd from './Kbd.vue';

const meta = {
    component: Kbd,
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The hints of the mockups: on the window, on a filled button, and the small one of a row. */
export const Gallery: Story = {
    render: () => (
        <StoryPage>
            <StorySection title="Default">
                <StoryRow>
                    <Kbd>⌘K</Kbd>
                    <Kbd>A</Kbd>
                    <Kbd>⌥L</Kbd>
                    <Kbd>⌘↵</Kbd>
                </StoryRow>
            </StorySection>
            <StorySection title="On a filled button">
                <StoryRow>
                    <span style={{ padding: '6px 12px', background: '#7b87f7', borderRadius: '7px' }}>
                        <Kbd tone="onFill">⌘↵</Kbd>
                    </span>
                    <span style={{ padding: '6px 12px', background: '#e4e6ea', borderRadius: '7px' }}>
                        <Kbd tone="onFill">↵</Kbd>
                    </span>
                </StoryRow>
            </StorySection>
            <StorySection title="Small">
                <StoryRow>
                    <Kbd size="sm">O</Kbd>
                </StoryRow>
            </StorySection>
        </StoryPage>
    ),
};
