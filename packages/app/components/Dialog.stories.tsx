import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage } from '@/.storybook/StoryLayout.jsx';

import Button from './Button.vue';
import Checkbox from './Checkbox.vue';
import Dialog from './Dialog.vue';
import TextField from './TextField.vue';

const meta: Meta<typeof Dialog> = {
    component: Dialog,
};

export default meta;

type Story = StoryObj<typeof Dialog>;

/** A titled dialog with a field and actions along the bottom, opened from a button. */
export const NewIssue: Story = {
    render: () =>
        defineComponent({
            setup() {
                const open = ref(false);
                const title = ref('');
                const another = ref(false);

                return () => (
                    <StoryPage>
                        <Dialog
                            open={open.value}
                            onUpdate:open={(value: boolean) => (open.value = value)}
                            title="New issue"
                            description="In skyline-labs/portal"
                        >
                            {{
                                trigger: () => <Button>New issue</Button>,
                                default: () => (
                                    <TextField
                                        modelValue={title.value}
                                        onUpdate:modelValue={value => (title.value = value)}
                                        label="Title"
                                    />
                                ),
                                footer: () => [
                                    <Checkbox
                                        modelValue={another.value}
                                        onUpdate:modelValue={value => (another.value = value)}
                                        label="Create another"
                                    />,
                                    <Button
                                        variant="primary"
                                        kbd="Mod+Enter"
                                        onClick={() => (open.value = false)}
                                    >
                                        Create issue
                                    </Button>,
                                ],
                            }}
                        </Dialog>
                    </StoryPage>
                );
            },
        }),
};

/** Quick capture: no visible title, the content speaks for itself; still named for screen readers. */
export const TitleHidden: Story = {
    render: () =>
        defineComponent({
            setup() {
                const open = ref(false);
                const title = ref('');

                return () => (
                    <StoryPage>
                        <Dialog
                            open={open.value}
                            onUpdate:open={(value: boolean) => (open.value = value)}
                            title="Quick capture"
                            titleHidden
                            width={640}
                        >
                            {{
                                trigger: () => <Button>Capture</Button>,
                                default: () => (
                                    <TextField
                                        modelValue={title.value}
                                        onUpdate:modelValue={value => (title.value = value)}
                                        label="Title"
                                        placeholder="Issue title"
                                    />
                                ),
                            }}
                        </Dialog>
                    </StoryPage>
                );
            },
        }),
};
