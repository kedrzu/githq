import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage } from '@/.storybook/StoryLayout.jsx';

import TextArea from './TextArea.vue';

const meta = {
    component: TextArea,
} satisfies Meta<typeof TextArea>;

export default meta;

type Story = StoryObj<typeof meta>;

/** An issue's body: grows with its text. */
export const Body: Story = {
    render: () =>
        defineComponent({
            setup() {
                const body = ref(
                    'Recurring visits created before the DST change render one hour late in the week view.\n\nRepro: weekly visit on Oct 20, switch to Nov 3.',
                );

                return () => (
                    <StoryPage>
                        <div style={{ width: '480px' }}>
                            <TextArea
                                modelValue={body.value}
                                onUpdate:modelValue={value => (body.value = value ?? '')}
                                label="Description"
                                placeholder="Add a description…"
                                info="Markdown, as on GitHub."
                            />
                        </div>
                    </StoryPage>
                );
            },
        }),
};

/** A comment box: one line high until it holds more, its key drawn inside. */
export const CommentBox: Story = {
    render: () =>
        defineComponent({
            setup() {
                const comment = ref('');

                return () => (
                    <StoryPage>
                        <div style={{ width: '480px' }}>
                            <TextArea
                                modelValue={comment.value}
                                onUpdate:modelValue={value => (comment.value = value ?? '')}
                                label="Comment"
                                labelHidden
                                placeholder="Leave a comment…"
                                compact
                                kbd={comment.value ? '⌘↵' : 'R'}
                                aria-keyshortcuts="R Meta+Enter"
                            />
                        </div>
                    </StoryPage>
                );
            },
        }),
};
