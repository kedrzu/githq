import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { CircleDot, Columns3, GitCommitHorizontal, GitPullRequest, List } from 'lucide-vue-next';
import { defineComponent, ref } from 'vue';

import { StoryPage, StorySection } from '@/.storybook/StoryLayout.jsx';

import SegmentedTabs from './SegmentedTabs.vue';

// No `component`: Storybook's types can't take a generic component; the stories render it themselves.
const meta = {} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** My work's filter, the merge panel's methods with their keys, and the list's layout, the board not built yet. */
export const Gallery: Story = {
    render: () =>
        defineComponent({
            setup() {
                const filter = ref<'all' | 'needsMe' | 'waitingOnOthers'>('all');
                const layout = ref<'board' | 'list'>('list');
                const method = ref<'merge' | 'rebase' | 'squash'>('squash');
                const section = ref<'commits' | 'issues' | 'pullRequests'>('issues');

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
                        <StorySection title="Plain — keys shown">
                            <SegmentedTabs
                                modelValue={method.value}
                                onUpdate:modelValue={value => (method.value = value)}
                                label="Merge method"
                                showKeys
                                options={[
                                    { value: 'squash', label: 'Squash', keyshortcuts: '1' },
                                    { value: 'merge', label: 'Merge commit', keyshortcuts: '2' },
                                    { value: 'rebase', label: 'Rebase', keyshortcuts: '3' },
                                ]}
                            />
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
                        <StorySection title="Vertical — a repository's sections">
                            <div style={{ width: '220px' }}>
                                <SegmentedTabs
                                    modelValue={section.value}
                                    onUpdate:modelValue={value => (section.value = value)}
                                    label="Sections"
                                    orientation="vertical"
                                    options={[
                                        {
                                            value: 'issues',
                                            label: 'Issues',
                                            icon: CircleDot,
                                            keyshortcuts: '1',
                                            count: 5,
                                        },
                                        {
                                            value: 'pullRequests',
                                            label: 'Pull requests',
                                            icon: GitPullRequest,
                                            keyshortcuts: '2',
                                            count: 1,
                                        },
                                        {
                                            value: 'commits',
                                            label: 'Commits',
                                            icon: GitCommitHorizontal,
                                            keyshortcuts: '3',
                                        },
                                    ]}
                                />
                            </div>
                            <span tid="section">Section: {section.value}</span>
                        </StorySection>
                    </StoryPage>
                );
            },
        }),
};
