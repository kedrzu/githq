import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { computed, defineComponent, ref } from 'vue';

import { StoryPage } from '@/.storybook/StoryLayout.jsx';

import type { FilterListGroup, FilterListRow } from './FilterList.vue';
import FilterList from './FilterList.vue';

// A generic component: Storybook's types take no generic one as `component`.
const meta = {
    title: 'Components/FilterList',
} satisfies Meta;

export default meta;

type Story = StoryObj;

/** A row of the story's list. */
interface FruitRow extends FilterListRow {
    readonly label: string;
}

const FRUIT: readonly FruitRow[] = [
    { value: 'apple', label: 'Apple' },
    { value: 'apricot', label: 'Apricot' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
];

/** Type to narrow, ↑/↓ and Enter: Enter picks the best match; a disabled row is shown, not picked. */
export const Filtered: Story = {
    render: () =>
        defineComponent({
            setup() {
                const query = ref('');
                const picked = ref('Nothing picked');
                const groups = computed((): FilterListGroup<FruitRow>[] => [
                    {
                        key: 'fruit',
                        heading: 'Fruit',
                        rows: FRUIT.filter(row => row.label.toLowerCase().includes(query.value.trim().toLowerCase())),
                    },
                ]);

                return () => (
                    <StoryPage>
                        <div style={{ width: '360px', border: '1px solid var(--color-border)' }}>
                            <FilterList
                                v-model:query={query.value}
                                modelValue={null}
                                label="Fruit"
                                groups={groups.value}
                                placeholder="Filter fruit…"
                                message={groups.value[0]?.rows.length === 0 ? 'Nothing matches' : null}
                                hints={[{ keys: '↵', label: 'Pick' }]}
                                onUpdate:modelValue={value => (picked.value = `Picked: ${String(value)}`)}
                            >
                                {{
                                    row: ({ row }: { row: FruitRow }) => <span>{row.label}</span>,
                                }}
                            </FilterList>
                        </div>
                        <p tid="picked">{picked.value}</p>
                    </StoryPage>
                );
            },
        }),
};
