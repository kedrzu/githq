import { createHeightTree } from './createHeightTree.js';

/** What the list needs of a row: a key that stays the row's when the rows change. */
export interface AnchoredListRow {
    key: string;
}

/**
 * "Where you are" (code review's D7): a row, and the distance of its top from the viewport's top. It is negative while
 * the row's top is above the viewport.
 */
export interface AnchoredListAnchor {
    key: string;
    offset: number;
}

/** Rows from `start` up to, and not including, `end`. */
export interface AnchoredListRange {
    start: number;
    end: number;
}

/** A row to draw, at its top within the list. */
export interface AnchoredListPlacedRow<T> {
    row: T;
    index: number;
    top: number;
}

/** The pinned row the viewport is inside, and how far the next pinned row has pushed it up. */
export interface AnchoredListPinnedRow<T> {
    row: T;
    index: number;
    pushUp: number;
}

/** How rows the list has not measured yet are sized, which of them pin, and the room a pinned row keeps over itself. */
export interface AnchoredListModelOptions<T> {
    estimateHeight(row: T): number;
    isPinned(row: T): boolean;
    /** How far below the one it pushes up a pinned row stays: the push starts that much before it arrives. */
    pushRoom?(row: T): number;
}

/** The arithmetic of a list that holds a row in place. It knows no DOM: the component feeds it what the browser says. */
export interface AnchoredListModel<T> {
    readonly anchor: AnchoredListAnchor | null;
    /** The height of everything. */
    readonly total: number;
    /** The scroll position that puts the anchor where it belongs; it may lie outside what the list can scroll to. */
    readonly anchorScrollTop: number;
    /**
     * Takes new rows, in O(n), and keeps the anchor on its row. If that row is gone, the row now at its index takes over,
     * never above the viewport's top (a file marked viewed, D9: the next one arrives where it started, or at the top of
     * the screen).
     */
    setRows(rows: readonly T[]): void;
    /** Records a row's real height, in O(log n); `true` when that changes the current rows' layout. */
    setMeasuredHeight(key: string, height: number): boolean;
    /** Makes the first row whose bottom is below `scrollTop` the anchor, after a scroll by the user. */
    captureAnchor(scrollTop: number): void;
    /** Makes the row the anchor; `false` when no row has that key. */
    jumpTo(key: string, offset: number): boolean;
    /** The rows touching the part of the list from `start` to `end`, as positions. */
    rangeBetween(start: number, end: number): AnchoredListRange;
    /** The rows of a range, each with its top. */
    placeRows(range: AnchoredListRange): AnchoredListPlacedRow<T>[];
    /** The last pinned row at or above the viewport's top. */
    pinnedAt(scrollTop: number): AnchoredListPinnedRow<T> | null;
    /** The first row that shows at that scroll position: the pinned row's overlay hides what's under it. */
    firstVisibleRow(scrollTop: number): T | null;
}

/**
 * Creates the model. Heights measured stay by key for as long as the model lives, so rows that come back after `rows`
 * changed do not fall back to estimates.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createAnchoredListModel<T extends AnchoredListRow>(
    options: AnchoredListModelOptions<T>,
): AnchoredListModel<T> {
    const measuredHeights = new Map<string, number>();
    const indexByKey = new Map<string, number>();
    let rows: readonly T[] = [];
    let heights = createHeightTree(new Float64Array(0));
    let pinnedIndices: number[] = [];
    let anchor: AnchoredListAnchor | null = null;
    let anchorIndex = 0;

    return {
        get anchor() {
            return anchor;
        },
        get total() {
            return heights.total;
        },
        get anchorScrollTop() {
            return anchor === null ? 0 : heights.top(anchorIndex) - anchor.offset;
        },
        setRows,
        setMeasuredHeight,
        captureAnchor,
        jumpTo,
        rangeBetween,
        placeRows,
        pinnedAt,
        firstVisibleRow,
    };

    function setRows(newRows: readonly T[]) {
        rows = newRows;
        const newHeights = new Float64Array(rows.length);
        indexByKey.clear();
        pinnedIndices = [];

        let index = 0;
        for (const row of rows) {
            newHeights[index] = measuredHeights.get(row.key) ?? options.estimateHeight(row);
            indexByKey.set(row.key, index);
            if (options.isPinned(row)) {
                pinnedIndices.push(index);
            }

            index++;
        }

        heights = createHeightTree(newHeights);
        followAnchor();
    }

    /** With no rows at all the anchor stays as it is, for the rows to come back to. */
    function followAnchor() {
        if (rows.length === 0) {
            anchorIndex = 0;
            return;
        }

        const index = anchor === null ? undefined : indexByKey.get(anchor.key);
        if (index != null) {
            anchorIndex = index;
            return;
        }

        anchorIndex = anchor === null ? 0 : Math.min(anchorIndex, rows.length - 1);
        anchor = { key: rowAt(anchorIndex).key, offset: Math.max(anchor?.offset ?? 0, 0) };
    }

    function setMeasuredHeight(key: string, height: number) {
        measuredHeights.set(key, height);
        const index = indexByKey.get(key);
        if (index === undefined || heights.height(index) === height) {
            return false;
        }

        heights.setHeight(index, height);
        return true;
    }

    function captureAnchor(scrollTop: number) {
        const index = heights.indexAt(Math.max(scrollTop, 0));
        if (index < 0) {
            return;
        }

        anchorIndex = index;
        anchor = { key: rowAt(index).key, offset: heights.top(index) - scrollTop };
    }

    function jumpTo(key: string, offset: number) {
        const index = indexByKey.get(key);
        if (index === undefined) {
            return false;
        }

        anchorIndex = index;
        anchor = { key, offset };
        return true;
    }

    function rangeBetween(start: number, end: number): AnchoredListRange {
        if (rows.length === 0) {
            return { start: 0, end: 0 };
        }

        return { start: heights.indexAt(Math.max(start, 0)), end: heights.indexAt(end) + 1 };
    }

    function placeRows(range: AnchoredListRange) {
        const placed: AnchoredListPlacedRow<T>[] = [];
        let top = heights.top(range.start);
        for (let index = range.start; index < range.end; index++) {
            placed.push({ row: rowAt(index), index, top });
            top += heights.height(index);
        }

        return placed;
    }

    function pinnedAt(scrollTop: number): AnchoredListPinnedRow<T> | null {
        const position = lastPinnedAtOrBefore(heights.indexAt(Math.max(scrollTop, 0)));
        const index = pinnedIndices[position];
        if (index === undefined) {
            return null;
        }

        const next = pinnedIndices[position + 1];
        const room =
            next === undefined ? Infinity : heights.top(next) - (options.pushRoom?.(rowAt(next)) ?? 0) - scrollTop;
        return { row: rowAt(index), index, pushUp: Math.max(heights.height(index) - room, 0) };
    }

    function firstVisibleRow(scrollTop: number) {
        const pinned = pinnedAt(scrollTop);
        const covered = pinned ? heights.height(pinned.index) - pinned.pushUp : 0;
        const index = heights.indexAt(Math.max(scrollTop, 0) + covered);
        if (index < 0) {
            return null;
        }

        const row = rowAt(index);
        // A pinned row with no rows of its own under it (a collapsed file's header) is itself what shows at the top, not
        // the next pinned row right after it.
        return pinned && index === pinned.index + 1 && options.isPinned(row) ? pinned.row : row;
    }

    /** The position in `pinnedIndices`, -1 when every pinned row is below `index`. */
    function lastPinnedAtOrBefore(index: number) {
        let low = 0;
        let high = pinnedIndices.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if ((pinnedIndices[middle] ?? 0) <= index) {
                low = middle + 1;
            } else {
                high = middle;
            }
        }

        return low - 1;
    }

    function rowAt(index: number): T {
        const row = rows[index];
        if (row === undefined) {
            throw new RangeError(`No row at index ${index}`);
        }

        return row;
    }
}
