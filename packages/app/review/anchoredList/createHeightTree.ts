/** A list's row heights with their prefix sums: every operation but the build is O(log n). */
export interface HeightTree {
    /** The sum of all heights. */
    readonly total: number;
    /** The height of one row. */
    height(index: number): number;
    /** Replaces one row's height. */
    setHeight(index: number, height: number): void;
    /** The sum of the heights before the row: its top. `index` may be the row count, which gives the total. */
    top(index: number): number;
    /**
     * The row holding a position: the first whose bottom is below it, so rows of no height are passed over. A position
     * past the end gives the last row, and -1 means there are no rows.
     */
    indexAt(position: number): number;
}

/**
 * A Fenwick tree over `heights`, in O(n). It takes the array over, keeping it as the rows' current heights.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createHeightTree(heights: Float64Array): HeightTree {
    const count = heights.length;
    // 1-based: node `i` sums the `i & -i` rows ending at row `i - 1`.
    const tree = new Float64Array(count + 1);
    let topBit = 1;
    while (topBit * 2 <= count) {
        topBit *= 2;
    }

    for (let node = 1; node <= count; node++) {
        tree[node] = (tree[node] ?? 0) + (heights[node - 1] ?? 0);
        const parent = node + (node & -node);
        if (parent <= count) {
            tree[parent] = (tree[parent] ?? 0) + (tree[node] ?? 0);
        }
    }

    return {
        get total() {
            return top(count);
        },
        height: index => heights[index] ?? 0,
        setHeight,
        top,
        indexAt,
    };

    function setHeight(index: number, height: number) {
        const delta = height - (heights[index] ?? 0);
        heights[index] = height;
        for (let node = index + 1; node <= count; node += node & -node) {
            tree[node] = (tree[node] ?? 0) + delta;
        }
    }

    function top(index: number) {
        let sum = 0;
        for (let node = index; node > 0; node -= node & -node) {
            sum += tree[node] ?? 0;
        }

        return sum;
    }

    function indexAt(position: number) {
        let passed = 0;
        let sum = 0;
        for (let bit = topBit; bit > 0; bit >>= 1) {
            const next = passed + bit;
            if (next <= count) {
                const nextSum = sum + (tree[next] ?? 0);
                if (nextSum <= position) {
                    passed = next;
                    sum = nextSum;
                }
            }
        }

        return Math.min(passed, count - 1);
    }
}
