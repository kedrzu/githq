import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Building2, Lock, User } from 'lucide-vue-next';
import { defineComponent, ref } from 'vue';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import ChoiceList from './ChoiceList.vue';

// No `component`: Storybook's types can't take a generic component; the stories render it themselves.
const meta = {} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** The tracking choice's owners: all of them, the user, an organisation, one hiding its private data. */
export const Gallery: Story = {
    render: () =>
        defineComponent({
            setup() {
                const owner = ref('all');

                return () => (
                    <StoryPage>
                        <StorySection title="Owners">
                            <div style={{ width: '200px' }}>
                                <ChoiceList
                                    modelValue={owner.value}
                                    onUpdate:modelValue={value => (owner.value = value)}
                                    label="Owners"
                                    options={[
                                        {
                                            value: 'all',
                                            label: 'All owners',
                                            count: '4 / 40',
                                            countLabel: '4 of 40 selected',
                                        },
                                        {
                                            value: 'kedrzu',
                                            label: 'kedrzu',
                                            icon: User,
                                            count: '4 / 12',
                                            countLabel: '4 of 12 selected',
                                        },
                                        {
                                            value: 'sigma-clinic',
                                            label: 'sigma-clinic',
                                            icon: Building2,
                                            count: '0 / 26',
                                            countLabel: '0 of 26 selected',
                                        },
                                        {
                                            value: 'acme-health',
                                            label: 'acme-health',
                                            icon: Lock,
                                            warning: true,
                                            count: '0 / 2',
                                            countLabel: '0 of 2 selected',
                                        },
                                    ]}
                                />
                            </div>
                            <span tid="owner">Owner: {owner.value}</span>
                        </StorySection>
                    </StoryPage>
                );
            },
        }),
};
