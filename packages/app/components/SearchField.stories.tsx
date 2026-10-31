import { Plus } from 'lucide-vue-next';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import Button from './Button.vue';
import SearchField from './SearchField.vue';

const meta = {
    component: SearchField,
} satisfies Meta<typeof SearchField>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A page's filter with its key, a header's smaller one, and a field naming something to track with its button. */
export const Gallery: Story = {
    render: () =>
        defineComponent({
            setup() {
                const filter = ref('');
                const typed = ref('pay');
                const name = ref('');

                return () => (
                    <StoryPage>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '470px' }}>
                            <StorySection title="A page's filter">
                                <SearchField
                                    modelValue={filter.value}
                                    onUpdate:modelValue={value => (filter.value = value ?? '')}
                                    label="Filter repositories"
                                    placeholder="Filter 327 repositories…"
                                    kbd="/"
                                />
                                <SearchField
                                    modelValue={typed.value}
                                    onUpdate:modelValue={value => (typed.value = value ?? '')}
                                    label="Filter repositories"
                                    kbd="/"
                                />
                            </StorySection>
                            <StorySection title="A header's">
                                <SearchField
                                    modelValue={filter.value}
                                    onUpdate:modelValue={value => (filter.value = value ?? '')}
                                    label="Find a repository to track"
                                    placeholder="Find a repository to track…"
                                    kbd="/"
                                    size="sm"
                                />
                            </StorySection>
                            <StorySection title="With a button">
                                <SearchField
                                    modelValue={name.value}
                                    onUpdate:modelValue={value => (name.value = value ?? '')}
                                    label="Repository or project to track"
                                    placeholder="owner/repository, or a project URL"
                                    icon={Plus}
                                >
                                    {{
                                        end: () => (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                            >
                                                Track
                                            </Button>
                                        ),
                                    }}
                                </SearchField>
                            </StorySection>
                        </div>
                    </StoryPage>
                );
            },
        }),
};
