import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { CircleCheck, CircleSlash } from 'lucide-vue-next';
import { defineComponent, ref } from 'vue';

import { StoryPage, StoryRow } from '@/.storybook/StoryLayout.jsx';

import MenuItem from './MenuItem.vue';
import SplitButton from './SplitButton.vue';

const meta = {
    component: SplitButton,
    args: { menuLabel: 'More ways to close' },
} satisfies Meta<typeof SplitButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Button / medium · menu`: an issue's "Close issue" (⇧X closes as completed), the chevron opening the other ways. */
export const CloseIssue: Story = {
    render: () =>
        defineComponent({
            setup() {
                const done = ref('nothing');

                return () => (
                    <StoryPage>
                        <StoryRow>
                            <SplitButton
                                icon={CircleCheck}
                                kbd="Shift+X"
                                keyshortcuts="Shift+X"
                                menuLabel="More ways to close"
                                onClick={() => (done.value = 'completed')}
                            >
                                {{
                                    default: () => 'Close issue',
                                    menu: () => [
                                        <MenuItem
                                            icon={CircleCheck}
                                            onSelect={() => (done.value = 'completed')}
                                        >
                                            Close as completed
                                        </MenuItem>,
                                        <MenuItem
                                            icon={CircleSlash}
                                            onSelect={() => (done.value = 'not planned')}
                                        >
                                            Close as not planned
                                        </MenuItem>,
                                    ],
                                }}
                            </SplitButton>
                            <span tid="done">Closed as: {done.value}</span>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
};
