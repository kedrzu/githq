import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage } from '@/.storybook/StoryLayout.jsx';

import PasswordField from './PasswordField.vue';

const meta = {
    component: PasswordField,
} satisfies Meta<typeof PasswordField>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A pasted token, masked; with an error. */
export const Token: Story = {
    render: () =>
        defineComponent({
            setup() {
                const token = ref('gho_16C7e42F292c6912E7710c838347Ae178B4a');

                return () => (
                    <StoryPage>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '360px' }}>
                            <PasswordField
                                modelValue={token.value}
                                onUpdate:modelValue={value => (token.value = value)}
                                label="Token"
                            />
                            <PasswordField
                                modelValue={token.value}
                                onUpdate:modelValue={value => (token.value = value)}
                                label="Rejected token"
                                errors="GitHub didn't accept this token."
                            />
                        </div>
                    </StoryPage>
                );
            },
        }),
};
