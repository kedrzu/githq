import { describe, expect, test } from 'bun:test';

import { filterOptions, findOptionLabels } from './filterOptions.js';
import type { FilterableOption, FoundOption } from './filterOptions.js';

const OPTIONS: readonly FilterableOption[] = [
    { label: 'Todo', group: 'Platform Q4' },
    { label: 'In progress', group: 'Platform Q4' },
    { label: 'Done', group: 'Billing' },
    { label: 'Doing', group: 'Billing', detail: 'In progress' },
    { label: 'Żółty', group: 'Labels' },
];

function labels(found: readonly FoundOption<FilterableOption>[]) {
    return found.map(({ option }) => option.label);
}

describe('nothing typed', () => {
    test('lists the options as given, unmarked, even when a group is not together', () => {
        const options = [{ label: 'a', group: 'x' }, { label: 'b' }, { label: 'c', group: 'x' }];

        for (const query of ['', '   ']) {
            expect(filterOptions(query, options)).toEqual(
                options.map(option => ({ option, score: 0, field: null, ranges: null })),
            );
        }
    });
});

describe('ranking', () => {
    test('finds with a typo, in any word order, and without diacritics', () => {
        expect(labels(filterOptions('progrss', OPTIONS))).toEqual(['In progress', 'Doing']);
        expect(labels(filterOptions('progress in', OPTIONS))).toEqual(['In progress', 'Doing']);
        expect(labels(filterOptions('zolty', OPTIONS))).toEqual(['Żółty']);
    });

    test('finds letters scattered in a label, below the rule, but not in a detail', () => {
        const options = [{ label: 'Set status' }, { label: 'sts now' }, { label: 'Other', detail: 'Set status' }];
        const found = filterOptions('sts', options);

        expect(labels(found)).toEqual(['sts now', 'Set status']);
        expect(found[1]).toMatchObject({ field: 'label', ranges: [0, 1, 2, 3, 4, 5] });
    });

    test('keeps the list order among equals', () => {
        const options = [{ label: 'Fix b' }, { label: 'Fix a' }, { label: 'Fix c' }];

        expect(labels(filterOptions('fix', options))).toEqual(['Fix b', 'Fix a', 'Fix c']);
    });
});

describe('label and detail', () => {
    test('the same match in a label outranks it in a detail, wherever the list has them', () => {
        const inDetail = { label: 'Alice', detail: 'kedrzu' };
        const inLabel = { label: 'kedrzu', detail: 'Bob' };

        expect(filterOptions('kedrzu', [inDetail, inLabel])).toEqual([
            { option: inLabel, score: 100, field: 'label', ranges: [0, 6] },
            { option: inDetail, score: 70, field: 'detail', ranges: [0, 6] },
        ]);
    });

    test('a detail counts 30 below: a strong one beats a weak label, a label beats its own weaker detail', () => {
        const options = [
            { label: 'Holding fix', detail: 'other' },
            { label: 'Other', detail: 'fix' },
            { label: 'Fix it', detail: 'fix' },
        ];
        const found = filterOptions('fix', options);

        expect(labels(found)).toEqual(['Fix it', 'Other', 'Holding fix']);
        expect(found.map(({ field, score }) => [field, score])).toEqual([
            ['label', 80],
            ['detail', 70],
            ['label', 60],
        ]);
    });
});

describe('groups', () => {
    test('the group holding the best match comes first, and rows rank within it', () => {
        const options = [
            { label: 'Review later', group: 'Second' },
            { label: 'Some review', group: 'First' },
            { label: 'Review', group: 'First' },
        ];

        expect(labels(filterOptions('review', options))).toEqual(['Review', 'Some review', 'Review later']);
    });

    test('rows of a group scattered through the list and the ranking end up together: no heading repeats', () => {
        const options = [
            { label: 'Fix', group: 'A' },
            { label: 'Fix it', group: 'B' },
            { label: 'Some fix', group: 'A' },
            { label: 'To fix', group: 'B' },
            { label: 'Prefixed' },
        ];
        const groups = filterOptions('fix', options).map(({ option }) => option.group);

        expect(groups).toEqual(['A', 'A', 'B', 'B', undefined]);
    });
});

describe('a long list', () => {
    const THRESHOLD = 1000;

    function hydrates(count: number) {
        return Array.from({ length: count }, (_, index) => ({ label: `Hydrate ${index}` }));
    }

    test('finds letters scattered up to the threshold, none above it', () => {
        expect(filterOptions('hdt', hydrates(THRESHOLD))).toHaveLength(THRESHOLD);
        expect(filterOptions('hdt', hydrates(THRESHOLD + 1))).toEqual([]);
    });

    test('ranks only its first hits, in a label and in a detail', () => {
        const inLabels = filterOptions('hydrate', [...hydrates(THRESHOLD + 200), { label: 'Hydrate' }]);
        const details = Array.from({ length: THRESHOLD + 200 }, (_, index) => ({
            label: `Row ${index}`,
            detail: 'Hydrate',
        }));

        expect(inLabels).toHaveLength(THRESHOLD);
        expect(inLabels.map(({ score }) => score)).not.toContain(100);
        expect(filterOptions('hydrate', details)).toHaveLength(THRESHOLD);
    });
});

describe('prepared texts', () => {
    test('an array is read once; a new one is read anew', () => {
        let reads = 0;
        const options = [
            {
                get label() {
                    reads++;
                    return 'Done';
                },
            },
        ];

        expect(filterOptions('don', options)).toHaveLength(1);
        const once = reads;
        expect(once).toBeGreaterThan(0);

        expect(filterOptions('do', options)).toHaveLength(1);
        expect(findOptionLabels('do', options)).toHaveLength(1);
        expect(reads).toBe(once);

        expect(filterOptions('don', [...options])).toHaveLength(1);
        expect(reads).toBeGreaterThan(once);
    });
});

describe('a typo', () => {
    function reviews(count: number) {
        return Array.from({ length: count }, (_, index) => ({ label: `Reactivity ${index}` }));
    }

    test('finds a label of a long list in its submenu', () => {
        expect(filterOptions('reactivty', reviews(1001))).toHaveLength(1000);
    });

    test('finds a label directly up to the threshold, none above it', () => {
        expect(findOptionLabels('reactivty', reviews(1000))).toHaveLength(1000);
        expect(findOptionLabels('reactivty', reviews(1001))).toEqual([]);
        expect(findOptionLabels('reactivity', reviews(1001))).toHaveLength(1000);
    });
});

describe('findOptionLabels', () => {
    test('finds by the label, with no scattered letters and no detail, and says where', () => {
        const inProgress: FilterableOption = { label: 'In progress' };
        const options = [inProgress, { label: 'Other', detail: 'progress' }];

        expect(findOptionLabels('prog', options)).toEqual([{ option: inProgress, score: 60, ranges: [3, 7] }]);
        expect(findOptionLabels('ipg', options)).toEqual([]);
    });
});

test('finds punctuation literally', () => {
    expect(filterOptions('-', [{ label: 'compiler-sfc' }, { label: 'runtime' }])).toEqual([
        { option: { label: 'compiler-sfc' }, score: 40, field: 'label', ranges: [8, 9] },
    ]);
});
