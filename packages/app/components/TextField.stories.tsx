import { Form } from '@nzyme/vue-forms/components/Form.jsx';
import { useForm } from '@nzyme/vue-forms/useForm.js';
import { useFormFields } from '@nzyme/vue-forms/useFormFields.js';
import { maxLengthValidator } from '@nzyme/vue-forms/validators/maxLengthValidator.js';
import { requiredValidator } from '@nzyme/vue-forms/validators/requiredValidator.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import Button from './Button.vue';
import TextField from './TextField.vue';

const meta = {
    component: TextField,
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Bound by `v-model`, with a hint; disabled; with an error given from outside. */
export const Gallery: Story = {
    render: () =>
        defineComponent({
            setup() {
                const title = ref('Reminders skip the first visit after a DST change');
                const empty = ref('');

                return () => (
                    <StoryPage>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '360px' }}>
                            <StorySection title="With a hint">
                                <TextField
                                    modelValue={title.value}
                                    onUpdate:modelValue={value => (title.value = value)}
                                    label="Title"
                                    info="Shown in the list and on GitHub."
                                />
                            </StorySection>
                            <StorySection title="Placeholder, disabled">
                                <TextField
                                    modelValue={empty.value}
                                    onUpdate:modelValue={value => (empty.value = value)}
                                    label="Milestone"
                                    placeholder="No milestone"
                                    disabled
                                />
                            </StorySection>
                            <StorySection title="An error from outside">
                                <TextField
                                    modelValue={title.value}
                                    onUpdate:modelValue={value => (title.value = value)}
                                    label="Branch"
                                    errors="A branch with this name already exists."
                                />
                            </StorySection>
                        </div>
                    </StoryPage>
                );
            },
        }),
};

/** In a form: a required title of at most 20 characters, validated as it is edited and on submit. */
export const InForm: Story = {
    render: () =>
        defineComponent({
            setup() {
                const form = useForm({ title: '' });
                const fields = useFormFields(form, {
                    title: [requiredValidator(), maxLengthValidator({ maxLength: 20 })],
                });
                const created = ref<string | null>(null);

                async function create() {
                    if (!(await form.validate())) {
                        return;
                    }

                    created.value = form.value.title;
                }

                return () => (
                    <StoryPage>
                        <Form onSubmit={create}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '360px' }}>
                                <TextField
                                    field={fields.title}
                                    label="Title"
                                    required
                                />
                                <div>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                    >
                                        Create issue
                                    </Button>
                                </div>
                            </div>
                        </Form>
                        <span tid="created">Created: {created.value ?? 'nothing'}</span>
                    </StoryPage>
                );
            },
        }),
};
