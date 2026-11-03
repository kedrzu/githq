import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, reactive, ref, shallowRef } from 'vue';
import type { PropType } from 'vue';

import Button from '@/components/Button.vue';

import type { AnchoredListExposed } from './AnchoredList.vue';
import AnchoredList from './AnchoredList.vue';

interface StoryRowData {
    key: string;
    /** Its real height, which the list only learns by drawing it; none for rows of wrapping text. */
    height?: number;
    text: string;
    pinned: boolean;
}

/** What the estimates say; the rows are really 18 to 55.5 px. */
const ESTIMATE = 24;
const WRAPPING_TEXT =
    'A line long enough to wrap when the list is narrow, and to take fewer lines when it is wide again. ';

/** A list with a toolbar that does to it what its owner would. */
const Demo = defineComponent({
    props: {
        count: { type: Number, default: 10_000 },
        /** A pinned header every this many rows. */
        sectionSize: { type: Number, default: 0 },
        wrapping: { type: Boolean, default: false },
        jumpKey: { type: String, default: 'row-5000' },
        jumpOffset: { type: Number, default: 0 },
        /** Told each time a row's slot runs. */
        reportRender: Function as PropType<(key: string) => void>,
    },
    setup(props) {
        const list = ref<AnchoredListExposed>();
        const rows = shallowRef(createRows(props.count, props.sectionSize, props.wrapping));
        const grownBy = reactive(new Map<string, number>());
        const width = ref(600);
        let inserted = 0;

        return () => (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', color: '#e4e6ea' }}>
                <div style={{ display: 'flex', gap: '8px', padding: '8px' }}>
                    <Button onClick={() => list.value?.jumpTo(props.jumpKey, props.jumpOffset)}>Jump</Button>
                    <Button onClick={growRowAbove}>Grow above</Button>
                    <Button onClick={insertRowsAbove}>Insert above</Button>
                    <Button onClick={() => (width.value = width.value === 600 ? 300 : 600)}>Change width</Button>
                    <Button onClick={() => list.value?.focus()}>Focus</Button>
                </div>
                <div
                    tid="anchor"
                    style={{ height: '20px', padding: '0 8px', whiteSpace: 'nowrap' }}
                >
                    {`${list.value?.anchor?.key} ${list.value?.anchor?.offset}`}
                </div>
                <div style={{ width: `${width.value}px`, height: '480px' }}>
                    <AnchoredList
                        ref={list}
                        rows={rows.value}
                        estimateHeight={() => ESTIMATE}
                        isPinned={row => row.pinned}
                        label="Rows"
                    >
                        {{
                            default: ({ row }: { row: StoryRowData }) => {
                                props.reportRender?.(row.key);
                                return (
                                    <div
                                        tid={row.key}
                                        style={{
                                            height:
                                                row.height === undefined
                                                    ? undefined
                                                    : `${row.height + (grownBy.get(row.key) ?? 0)}px`,
                                            background: row.pinned ? '#1a1d22' : undefined,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {row.text}
                                    </div>
                                );
                            },
                        }}
                    </AnchoredList>
                </div>
            </div>
        );

        /** A rendered row, three above the one you are at. */
        function growRowAbove() {
            const key = rowNear(-3);
            grownBy.set(key, (grownBy.get(key) ?? 0) + 137.5);
        }

        function insertRowsAbove() {
            const index = rows.value.findIndex(row => row.key === list.value?.anchor?.key);
            const added: StoryRowData[] = [];
            for (let i = 0; i < 5; i++) {
                inserted++;
                added.push({ key: `inserted-${inserted}`, height: 41.5, text: `Inserted ${inserted}`, pinned: false });
            }

            rows.value = [...rows.value.slice(0, index - 2), ...added, ...rows.value.slice(index - 2)];
        }

        function rowNear(distance: number) {
            const index = rows.value.findIndex(row => row.key === list.value?.anchor?.key);
            return rows.value[index + distance]?.key ?? '';
        }
    },
});

function createRows(count: number, sectionSize: number, wrapping: boolean) {
    const rows: StoryRowData[] = [];
    for (let index = 0; index < count; index++) {
        const pinned = sectionSize > 0 && index % sectionSize === 0;
        rows.push({
            key: `row-${index}`,
            height: pinned ? 30 : wrapping ? undefined : 18 + ((index * 7919) % 7) * 6.25,
            text: wrapping && !pinned ? `Row ${index}. ${WRAPPING_TEXT.repeat(1 + (index % 3))}` : `Row ${index}`,
            pinned,
        });
    }

    return rows;
}

const meta = {
    component: Demo,
} satisfies Meta<typeof Demo>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Real heights differ from the estimates: jump, grow and insert hold the row you are at. */
export const Default: Story = {};

/** Rows of text whose heights depend on the width. */
export const Wrapping: Story = {
    args: { wrapping: true, count: 2000, jumpKey: 'row-1000' },
};

/** Sections whose headers pin at the top. */
export const PinnedHeaders: Story = {
    args: { sectionSize: 100, jumpKey: 'row-250' },
};

/** Size is not what it costs. */
export const TwoHundredThousandRows: Story = {
    args: { count: 200_000, sectionSize: 500, jumpKey: 'row-150000' },
};
