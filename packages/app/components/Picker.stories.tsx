import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Milestone, Tag } from 'lucide-vue-next';
import { defineComponent, ref } from 'vue';

import { StoryPage, StoryRow } from '@/.storybook/StoryLayout.jsx';

import Button from './Button.vue';
import type { PickerOption } from './Picker.vue';
import Picker from './Picker.vue';

const meta = {
    component: Picker,
} satisfies Meta<typeof Picker>;

export default meta;

type Story = StoryObj<typeof meta>;

const LABELS: PickerOption[] = [
    { value: 'bug', label: 'bug', color: 'd73a4a' },
    { value: 'calendar', label: 'calendar', color: '0e8a16' },
    { value: 'perf', label: 'perf', color: 'fbca04' },
    { value: 'regression', label: 'regression', color: 'b60205' },
    { value: 'good first issue', label: 'good first issue', color: '7057ff' },
];

const MILESTONES: PickerOption[] = [
    { value: 'v4.2', label: 'v4.2 — November', detail: 'due Nov 28' },
    { value: 'v4.3', label: 'v4.3 — December', detail: 'due Dec 19' },
];

const STATUSES: PickerOption[] = [
    { value: 'not-done', label: 'Not done yet', group: 'In flight' },
    { value: 'yellow', label: 'Żółty sprint', group: 'In flight' },
    { value: 'done', label: 'Done', group: 'Closed' },
];

/** L: labels of one issue, toggled and applied together when it closes. */
export const Labels: Story = {
    args: { label: 'Labels', options: LABELS },
    render: args =>
        defineComponent({
            setup() {
                const applied = ref('Nothing applied');

                return () => (
                    <StoryPage>
                        <StoryRow>
                            <Picker
                                {...args}
                                multiple
                                selected={['bug', 'calendar']}
                                placeholder="Filter labels…"
                                onApply={change =>
                                    (applied.value = `Added: ${change.added.join(', ') || '–'}; removed: ${change.removed.join(', ') || '–'}`)
                                }
                            >
                                {{
                                    trigger: () => (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            icon={Tag}
                                        >
                                            Labels
                                        </Button>
                                    ),
                                }}
                            </Picker>
                            <span tid="applied">{applied.value}</span>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
};

/** L on three selected items: a label two of them have is half-chosen, and a note says who can't be edited. */
export const LabelsOfSeveral: Story = {
    args: { label: 'Labels', options: LABELS },
    render: args =>
        defineComponent({
            setup() {
                const applied = ref('Nothing applied');

                return () => (
                    <StoryPage>
                        <StoryRow>
                            <Picker
                                {...args}
                                multiple
                                selected={['bug']}
                                mixed={['perf']}
                                note="2 of 3 editable — mobile#91 is in a repository you can only read"
                                onApply={change =>
                                    (applied.value = `Added: ${change.added.join(', ') || '–'}; removed: ${change.removed.join(', ') || '–'}`)
                                }
                            >
                                {{
                                    trigger: () => (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            icon={Tag}
                                        >
                                            Labels of 3 items
                                        </Button>
                                    ),
                                }}
                            </Picker>
                            <span tid="applied">{applied.value}</span>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
};

/** M: one milestone, with its due date, or none. Picking closes it. */
export const MilestonePicker: Story = {
    args: { label: 'Milestone', options: MILESTONES },
    render: args =>
        defineComponent({
            setup() {
                const picked = ref<string | null | undefined>(undefined);

                return () => (
                    <StoryPage>
                        <StoryRow>
                            <Picker
                                {...args}
                                selected={['v4.2']}
                                noneLabel="No milestone"
                                onPick={value => (picked.value = value)}
                            >
                                {{
                                    trigger: () => (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            icon={Milestone}
                                        >
                                            Milestone
                                        </Button>
                                    ),
                                }}
                            </Picker>
                            <span tid="picked">
                                {picked.value === undefined ? 'Nothing picked' : `Picked: ${picked.value ?? 'none'}`}
                            </span>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
};

/** Options under headings: typed text brings the group holding the best match first. */
export const Grouped: Story = {
    args: { label: 'Status', options: STATUSES },
    render: args =>
        defineComponent({
            setup() {
                const picked = ref('Nothing picked');

                return () => (
                    <StoryPage>
                        <StoryRow>
                            <Picker
                                {...args}
                                onPick={value => (picked.value = `Picked: ${value ?? 'none'}`)}
                            >
                                {{
                                    trigger: () => (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                        >
                                            Status
                                        </Button>
                                    ),
                                }}
                            </Picker>
                            <span tid="picked">{picked.value}</span>
                        </StoryRow>
                    </StoryPage>
                );
            },
        }),
};
