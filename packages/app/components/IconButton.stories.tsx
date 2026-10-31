import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Maximize2, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-vue-next';
import { defineComponent, ref } from 'vue';

import { StoryPage, StoryRow, StorySection } from '@/.storybook/StoryLayout.jsx';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import Avatar from './Avatar.vue';
import IconButton from './IconButton.vue';

const meta: Meta<typeof IconButton> = {
    component: IconButton,
};

export default meta;

type Story = StoryObj<typeof IconButton>;

/** In a header next to text, and on the rail; one shown but not built yet, one busy. */
export const Gallery: Story = {
    render: () => (
        <StoryPage>
            <StorySection title="Small — headers and toolbars">
                <StoryRow>
                    <IconButton
                        icon={PanelLeftClose}
                        label="Collapse sidebar"
                        kbd="["
                        aria-keyshortcuts="["
                    />
                    <IconButton
                        icon={Maximize2}
                        label="Open full page"
                    />
                    <IconButton
                        icon={X}
                        label="Close"
                        kbd="Esc"
                    />
                </StoryRow>
            </StorySection>
            <StorySection title="Medium — the rail">
                <StoryRow>
                    <IconButton
                        size="md"
                        label="Account: kedrzu"
                    >
                        <Avatar
                            name={SAMPLE_VIEWER.login}
                            size="md"
                            decorative
                        />
                    </IconButton>
                    <IconButton
                        size="md"
                        icon={PanelLeftOpen}
                        label="Expand sidebar"
                        kbd="["
                    />
                    <IconButton
                        size="md"
                        icon={Search}
                        label="Search or jump to…"
                        aria-disabled="true"
                    />
                    <IconButton
                        size="md"
                        icon={Search}
                        label="Searching"
                        busy
                    />
                </StoryRow>
            </StorySection>
        </StoryPage>
    ),
};

/** Hovered: the tooltip names it and gives its key. */
export const WithTooltip: Story = {
    render: () =>
        defineComponent({
            setup() {
                const clicks = ref(0);
                return () => (
                    <StoryPage>
                        <StoryRow>
                            <IconButton
                                icon={PanelLeftClose}
                                label="Collapse sidebar"
                                kbd="["
                                onClick={() => clicks.value++}
                            />
                            <span tid="clicks">Clicks: {clicks.value}</span>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
};
