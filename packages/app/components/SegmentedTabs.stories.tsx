import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Columns3, List } from 'lucide-vue-next';
import { defineComponent, ref } from 'vue';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import SegmentedTabs from './SegmentedTabs.vue';

// No `component`: Storybook's types can't take a generic component; the stories render it themselves.
const meta = {} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** My work's filter and the list's layout, the board not built yet. */
export const Gallery: Story = {
    render: () =>
        defineComponent({
            setup() {
                const filter = ref<'all' | 'needsMe' | 'waitingOnOthers'>('all');
                const layout = ref<'board' | 'list'>('list');

                return () => (
                    <StoryPage>
                        <StorySection title="Plain — a filter">
                            <SegmentedTabs
                                modelValue={filter.value}
                                onUpdate:modelValue={value => (filter.value = value)}
                                label="Filters"
                                options={[
                                    { value: 'all', label: 'All', keyshortcuts: '1' },
                                    { value: 'needsMe', label: 'Needs me', keyshortcuts: '2' },
                                    { value: 'waitingOnOthers', label: 'Waiting on others', keyshortcuts: '3' },
                                ]}
                            />
                            <span tid="filter">Filter: {filter.value}</span>
                        </StorySection>
                        <StorySection title="Boxed — icons">
                            <SegmentedTabs
                                modelValue={layout.value}
                                onUpdate:modelValue={value => (layout.value = value)}
                                label="Layout"
                                variant="boxed"
                                options={[
                                    { value: 'list', label: 'List', icon: List, iconOnly: true },
                                    { value: 'board', label: 'Board', icon: Columns3, iconOnly: true, disabled: true },
                                ]}
                            />
                        </StorySection>
                    </StoryPage>
                );
            },
        }),
};
