import type { Meta, StoryObj } from '@storybook/vue3-vite';
import {
    ChevronDown,
    CircleCheckBig,
    CircleSlash,
    Copy,
    ExternalLink,
    LogOut,
    Milestone,
    Rows3,
    Tag,
    User,
} from 'lucide-vue-next';
import { defineComponent, ref } from 'vue';

import { StoryPage, StoryRow } from '@/.storybook/StoryLayout.jsx';

import Button from './Button.vue';
import Menu from './Menu.vue';
import MenuItem from './MenuItem.vue';
import MenuLabel from './MenuLabel.vue';
import MenuRadioGroup from './MenuRadioGroup.vue';
import MenuRadioItem from './MenuRadioItem.vue';
import MenuSeparator from './MenuSeparator.vue';
import MenuSub from './MenuSub.vue';

const meta = {
    component: Menu,
} satisfies Meta<typeof Menu>;

export default meta;

type Story = StoryObj<typeof meta>;

/** An item's actions: a heading, items with icons and keys, one not available. */
export const Actions: Story = {
    render: () =>
        defineComponent({
            setup() {
                const picked = ref('nothing');

                return () => (
                    <StoryPage>
                        <StoryRow>
                            <Menu>
                                {{
                                    trigger: () => (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                        >
                                            Actions <ChevronDown aria-hidden="true" />
                                        </Button>
                                    ),
                                    default: () => [
                                        <MenuLabel>sigma-clinic/portal#1187</MenuLabel>,
                                        <MenuItem
                                            icon={ExternalLink}
                                            kbd="O"
                                            onSelect={() => (picked.value = 'open')}
                                        >
                                            Open on GitHub
                                        </MenuItem>,
                                        <MenuItem
                                            icon={Copy}
                                            onSelect={() => (picked.value = 'copy')}
                                        >
                                            Copy link
                                        </MenuItem>,
                                        <MenuItem
                                            icon={LogOut}
                                            disabled
                                        >
                                            Close issue
                                        </MenuItem>,
                                    ],
                                }}
                            </Menu>
                            <span tid="picked">Picked: {picked.value}</span>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
};

/** One choice out of several (`MenuRadioGroup`): a list's grouping, the chosen one checked, a choice with a detail. */
export const Choice: Story = {
    render: () =>
        defineComponent({
            setup() {
                const grouping = ref('milestone');

                return () => (
                    <StoryPage>
                        <StoryRow>
                            <Menu>
                                {{
                                    trigger: () => (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            icon={Rows3}
                                        >
                                            Group: {grouping.value}
                                        </Button>
                                    ),
                                    default: () => [
                                        <MenuLabel>From GitHub</MenuLabel>,
                                        <MenuRadioGroup
                                            modelValue={grouping.value}
                                            onUpdate:modelValue={(value: string) => (grouping.value = value)}
                                        >
                                            <MenuRadioItem
                                                value="milestone"
                                                icon={Milestone}
                                            >
                                                Milestone
                                            </MenuRadioItem>
                                            <MenuRadioItem
                                                value="assignee"
                                                icon={User}
                                            >
                                                Assignee
                                            </MenuRadioItem>
                                            <MenuRadioItem
                                                value="label"
                                                icon={Tag}
                                                detail="one column per label"
                                            >
                                                Label
                                            </MenuRadioItem>
                                        </MenuRadioGroup>,
                                    ],
                                }}
                            </Menu>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
};

/** Groups between lines, a detail after an item, keys as one chip per key, and a submenu beside its entry. */
export const Submenu: Story = {
    render: () =>
        defineComponent({
            setup() {
                const picked = ref('nothing');

                return () => (
                    <StoryPage>
                        <StoryRow>
                            <Menu>
                                {{
                                    trigger: () => (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                        >
                                            Issue <ChevronDown aria-hidden="true" />
                                        </Button>
                                    ),
                                    default: () => [
                                        <MenuItem
                                            icon={Copy}
                                            detail="portal#1187"
                                            onSelect={() => (picked.value = 'copy')}
                                        >
                                            Copy reference
                                        </MenuItem>,
                                        <MenuSeparator />,
                                        <MenuSub
                                            icon={CircleCheckBig}
                                            shortcut="Shift+X"
                                        >
                                            {{
                                                default: () => 'Close issue',
                                                content: () => [
                                                    <MenuItem
                                                        icon={CircleCheckBig}
                                                        onSelect={() => (picked.value = 'completed')}
                                                    >
                                                        Close as completed
                                                    </MenuItem>,
                                                    <MenuItem
                                                        icon={CircleSlash}
                                                        onSelect={() => (picked.value = 'notPlanned')}
                                                    >
                                                        Close as not planned
                                                    </MenuItem>,
                                                ],
                                            }}
                                        </MenuSub>,
                                    ],
                                }}
                            </Menu>
                            <span tid="picked">Picked: {picked.value}</span>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
};
