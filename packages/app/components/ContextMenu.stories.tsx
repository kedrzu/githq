import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Copy, ExternalLink } from 'lucide-vue-next';
import { defineComponent, ref } from 'vue';

import { StoryPage } from '@/.storybook/StoryLayout.jsx';
import { withPhoneLayout } from '@/testing/withPhoneLayout.js';

import ContextMenu from './ContextMenu.vue';
import MenuItem from './MenuItem.vue';
import MenuLabel from './MenuLabel.vue';
import MenuSeparator from './MenuSeparator.vue';

const meta: Meta<typeof ContextMenu> = {
    component: ContextMenu,
    // The story frame is narrower than a phone's width: the computer's menu unless a story says otherwise.
    decorators: [withPhoneLayout(false)],
};

export default meta;

type Story = StoryObj<typeof ContextMenu>;

/** A row's menu, opened by right-clicking it: a heading, items with their keys, a line between the groups. */
export const Row: Story = {
    render: () =>
        defineComponent({
            setup() {
                const picked = ref('nothing');

                return () => (
                    <StoryPage>
                        <ContextMenu>
                            {{
                                default: () => <p tid="row">Calendar shows wrong timezone for recurring bookings</p>,
                                content: () => [
                                    <MenuLabel>skyline-labs/portal#1187</MenuLabel>,
                                    <MenuItem
                                        icon={ExternalLink}
                                        shortcut="O"
                                        onSelect={() => (picked.value = 'github')}
                                    >
                                        Open on GitHub
                                    </MenuItem>,
                                    <MenuSeparator />,
                                    <MenuItem
                                        icon={Copy}
                                        shortcut="Shift+Mod+C"
                                        onSelect={() => (picked.value = 'copy')}
                                    >
                                        Copy link
                                    </MenuItem>,
                                ],
                            }}
                        </ContextMenu>
                        <span tid="picked">Picked: {picked.value}</span>
                    </StoryPage>
                );
            },
        }),
};

/**
 * Mobile D45: a row's menu on a phone, opened (by a long press, or later the row's swipe, D27) as a menu at the bottom —
 * the same heading, entries and line, as rows a finger's height, no keys.
 */
export const PhoneRow: Story = {
    decorators: [withPhoneLayout(true)],
    render: () =>
        defineComponent({
            setup() {
                const open = ref(true);
                const picked = ref('nothing');

                return () => (
                    <StoryPage>
                        <ContextMenu
                            open={open.value}
                            onUpdate:open={(value: boolean) => (open.value = value)}
                            context="skyline-labs/portal#1187"
                        >
                            {{
                                default: () => <p tid="row">Calendar shows wrong timezone for recurring bookings</p>,
                                content: () => [
                                    <MenuItem
                                        icon={ExternalLink}
                                        shortcut="O"
                                        onSelect={() => (picked.value = 'github')}
                                    >
                                        Open on GitHub
                                    </MenuItem>,
                                    <MenuSeparator />,
                                    <MenuItem
                                        icon={Copy}
                                        shortcut="Shift+Mod+C"
                                        onSelect={() => (picked.value = 'copy')}
                                    >
                                        Copy link
                                    </MenuItem>,
                                ],
                            }}
                        </ContextMenu>
                        <span tid="picked">Picked: {picked.value}</span>
                    </StoryPage>
                );
            },
        }),
};
