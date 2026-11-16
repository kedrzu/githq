import { useContainer } from '@nzyme/vue-ioc/useContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { userEvent, within } from 'storybook/test';
import { ChevronDown } from 'lucide-vue-next';
import { defineComponent, h } from 'vue';

import { StoryPage, StoryRow } from '@/.storybook/StoryLayout.jsx';
import Button from '@/components/Button.vue';
import Menu from '@/components/Menu.vue';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { withPhoneLayout } from '@/testing/withPhoneLayout.js';

import RepositoryContextMenu from './RepositoryContextMenu.vue';

const meta = {
    component: RepositoryContextMenu,
    args: { nameWithOwner: 'skyline-labs/portal', current: false },
    // The story frame is narrower than a phone's width: the computer's menu unless a story says otherwise.
    decorators: [
        withPhoneLayout(false),
        // The menu reads what is tracked, which the local copy keeps.
        story => {
            const Story = story();
            return defineComponent({
                setup() {
                    setIndexedDbPersistence(useContainer());
                    return () => h(Story);
                },
            });
        },
    ],
    render: args =>
        defineComponent({
            setup() {
                return () => (
                    <StoryPage>
                        <StoryRow>
                            <Menu modal={false}>
                                {{
                                    trigger: () => (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                        >
                                            {args.nameWithOwner} <ChevronDown />
                                        </Button>
                                    ),
                                    default: () => <RepositoryContextMenu {...args} />,
                                }}
                            </Menu>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
} satisfies Meta<typeof RepositoryContextMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

/** R4: another repository's menu, or one on a screen that is not its own: its sections without keys, which would do nothing there. */
export const Other: Story = { play: openMenu };

/** R4: the open repository's menu: its sections on `1`–`4`. */
export const Current: Story = { args: { current: true }, play: openMenu };

async function openMenu({ canvasElement }: { canvasElement: HTMLElement }) {
    await userEvent.click(within(canvasElement).getByRole('button'));
}
