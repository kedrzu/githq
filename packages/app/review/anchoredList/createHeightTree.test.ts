/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { createSeededRandom } from '@/testing/createSeededRandom.js';

import { createHeightTree } from './createHeightTree.js';

test('matches a plain array through random fractional changes, for tops and for positions, without drifting', () => {
    const random = createSeededRandom(11);
    for (const count of [1, 2, 3, 7, 8, 9, 1000]) {
        const plain = Array.from({ length: count }, () => randomHeight(random));
        const tree = createHeightTree(Float64Array.from(plain));

        for (let change = 0; change < 2000; change++) {
            const index = Math.floor(random() * count);
            const height = randomHeight(random);
            plain[index] = height;
            tree.setHeight(index, height);
        }

        let top = 0;
        for (let index = 0; index < count; index++) {
            expect(tree.top(index)).toBeCloseTo(top, 6);
            if (plain[index]! > 1e-6) {
                expect(tree.indexAt(top + 1e-6)).toBe(index);
                expect(tree.indexAt(top + plain[index]! - 1e-6)).toBe(index);
            }

            top += plain[index]!;
        }

        expect(tree.total).toBeCloseTo(top, 6);
    }
});

test('a position on the line between two rows belongs to the lower one, passing over rows of no height', () => {
    const tree = createHeightTree(Float64Array.from([10, 0, 0, 20, 30]));

    expect(tree.indexAt(0)).toBe(0);
    expect(tree.indexAt(9.5)).toBe(0);
    expect(tree.indexAt(10)).toBe(3);
    expect(tree.indexAt(30)).toBe(4);
});

test('a position past the end gives the last row, and no rows give -1', () => {
    expect(createHeightTree(Float64Array.from([10, 20])).indexAt(1000)).toBe(1);
    expect(createHeightTree(new Float64Array(0)).indexAt(0)).toBe(-1);
});

/** A height with a fraction, sometimes none at all. */
function randomHeight(random: () => number) {
    return random() < 0.1 ? 0 : 10 + random() * 40;
}
