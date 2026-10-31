import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ChevronDown, CircleCheckBig, CircleSlash, Link, Tag, UserPlus } from 'lucide-vue-next';
import { defineComponent, ref } from 'vue';

import { StoryPage, StoryRow } from '@/.storybook/StoryLayout.jsx';
import Button from '@/components/Button.vue';
import Menu from '@/components/Menu.vue';

import CommandMenuSections from './CommandMenuSections.vue';
import type { Command } from './CommandTypes.js';

const meta: Meta<typeof CommandMenuSections> = {
    component: CommandMenuSections,
};

export default meta;

type Story = StoryObj<typeof CommandMenuSections>;

const PEOPLE = ['kedrzu', 'pnowak', 'olam', 'tsw', 'srogal', 'mkowal', 'adudek', 'jzielin', 'bwrona'];

/**
 * L4: three issues selected together — assign with a filter over many people (one all three have, one only some
 * do), labels, copy their links, close them in a submenu; each with its key.
 */
export const Selection: Story = {
    render: () =>
        defineComponent({
            setup() {
                const picked = ref('nothing');
                const commands: Command[] = [
                    {
                        id: 'selection.assignees',
                        title: 'Assign to…',
                        section: 'selection',
                        key: 'A',
                        icon: UserPlus,
                        options: () => ({
                            note: 'Only people who can be assigned in both repositories.',
                            options: PEOPLE.map((login, index) => ({
                                value: login,
                                label: login,
                                detail: index === 0 ? '3 of 3' : index === 1 ? '1 of 3' : undefined,
                                chosen: index === 0,
                                mixed: index === 1,
                                pick: () => (picked.value = login),
                            })),
                        }),
                    },
                    {
                        id: 'selection.labels',
                        title: 'Add or remove labels…',
                        section: 'selection',
                        key: 'L',
                        icon: Tag,
                        options: () => ({
                            options: [
                                {
                                    value: 'bug',
                                    label: 'bug',
                                    color: 'e5534b',
                                    chosen: false,
                                    pick: () => (picked.value = 'bug'),
                                },
                            ],
                        }),
                    },
                    {
                        id: 'selection.copyLink',
                        title: 'Copy links',
                        section: 'selection',
                        icon: Link,
                        run: () => {
                            picked.value = 'links';
                        },
                    },
                    {
                        id: 'selection.state',
                        title: 'Close 3 issues',
                        section: 'selection',
                        key: 'Shift+X',
                        icon: CircleCheckBig,
                        options: () => ({
                            options: [
                                {
                                    value: 'completed',
                                    label: 'Close as completed',
                                    icon: CircleCheckBig,
                                    pick: () => (picked.value = 'completed'),
                                },
                                {
                                    value: 'notPlanned',
                                    label: 'Close as not planned',
                                    icon: CircleSlash,
                                    pick: () => (picked.value = 'notPlanned'),
                                },
                            ],
                        }),
                    },
                ];
                const [assign, labels, copy, close] = commands;

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
                                            3 issues <ChevronDown aria-hidden="true" />
                                        </Button>
                                    ),
                                    default: () => (
                                        <CommandMenuSections sections={[[assign!, labels!], [copy!], [], [close!]]} />
                                    ),
                                }}
                            </Menu>
                            <span tid="picked">Picked: {picked.value}</span>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
};
