import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

/** What a log window is laid over. */
export interface UseLogWindowOptions {
    /** The scrolling element. */
    readonly element: MaybeRefOrGetter<HTMLElement | null>;
    /** Each row's height. */
    readonly heights: MaybeRefOrGetter<Float64Array>;
    /** A row kept in the DOM wherever the view goes (a selection's start), within {@link MAX_PINNED_ROWS}. */
    readonly pinnedRow: MaybeRefOrGetter<number | null>;
    /** How much of the top of the view is covered (the sticky header). */
    readonly coveredTop: MaybeRefOrGetter<number>;
}

/**
 * Where a row goes when brought into view. `nearest`: the least move; `context`: low in the view with what is above it
 * showing, unless it shows already; `top`: at the top of the view.
 */
export type LogRevealMode = 'nearest' | 'context' | 'top';

/** A log's rows in view, as {@link useLogWindow} tells them. */
export interface LogWindowViewModel {
    /** The first row to render. */
    readonly start: number;
    /** Past the last row to render. */
    readonly end: number;
    /** The first row at least partly in view. */
    readonly firstVisible: number;
    readonly totalHeight: number;
    readonly scrollTop: number;
    readonly viewportHeight: number;
    /** Inside the scrollbar, if there is one. */
    readonly viewportWidth: number;
    getRowTop(row: number): number;
    getRowAt(y: number): number;
    reveal(row: number, mode: LogRevealMode): void;
    scrollTo(y: number): void;
    /**
     * Changes the rows' heights with the view staying where it is: at the row last brought into view if nothing was
     * scrolled since, else at the row on top. The change must be made inside.
     */
    keepInPlace(change: () => void): void;
    /** The scrolling element's own handler. */
    onScroll(): void;
}

/** Rows rendered past each end of the view. */
const OVERSCAN_ROWS = 12;
/** How far a pinned row may be from the view and still stay in the DOM. */
const MAX_PINNED_ROWS = 5000;
/** How low in the view a row brought in with `context` goes. */
const CONTEXT_POSITION = 0.8;

/**
 * Tells which rows of a log are in view, by their heights, so only those (and a few around them) are in the DOM; and
 * moves the view. The rows' tops are worked out in one pass over the heights, which is what a change of them costs.
 */
export function useLogWindow(options: UseLogWindowOptions): LogWindowViewModel {
    const element = makeRef(options.element);
    const heights = makeRef(options.heights);
    const pinnedRow = makeRef(options.pinnedRow);
    const coveredTop = makeRef(options.coveredTop);

    const scrollTop = ref(0);
    const viewportHeight = ref(0);
    const viewportWidth = ref(0);

    const tops = computed(() => {
        const rows = heights.value;
        const result = new Float64Array(rows.length + 1);
        let top = 0;
        for (const [row, height] of rows.entries()) {
            result[row] = top;
            top += height;
        }

        result[rows.length] = top;
        return result;
    });
    const totalHeight = computed(() => getRowTop(heights.value.length));
    const firstVisible = computed(() => getRowAt(scrollTop.value));
    const lastVisible = computed(() => getRowAt(scrollTop.value + viewportHeight.value));
    const start = computed(() => {
        const from = Math.max(0, firstVisible.value - OVERSCAN_ROWS);
        const pinned = pinnedRow.value;
        return pinned !== null && from - pinned <= MAX_PINNED_ROWS ? Math.min(from, pinned) : from;
    });
    const end = computed(() => {
        const to = Math.min(heights.value.length, lastVisible.value + 1 + OVERSCAN_ROWS);
        const pinned = pinnedRow.value;
        return pinned !== null && pinned - to <= MAX_PINNED_ROWS ? Math.max(to, pinned + 1) : to;
    });

    let observer: ResizeObserver | undefined;
    let lastReveal: { row: number; mode: LogRevealMode } | null = null;

    // After the render, so that the rows are there to scroll over.
    watch(
        scrollTop,
        top => {
            const scroller = element.value;
            if (scroller && Math.abs(scroller.scrollTop - top) >= 1) {
                scroller.scrollTop = top;
            }
        },
        { flush: 'post' },
    );

    onMounted(() => {
        const scroller = element.value;
        if (!scroller) {
            return;
        }

        measureViewport(scroller);
        observer = new ResizeObserver(() => measureViewport(scroller));
        observer.observe(scroller);
    });
    onBeforeUnmount(() => observer?.disconnect());

    return reactive<LogWindowViewModel>({
        start,
        end,
        firstVisible,
        totalHeight,
        scrollTop,
        viewportHeight,
        viewportWidth,
        getRowTop,
        getRowAt,
        reveal,
        scrollTo,
        keepInPlace,
        onScroll,
    });

    function getRowTop(row: number) {
        return tops.value[row] ?? 0;
    }

    /** The row at `y`; the last one past the end. */
    function getRowAt(y: number) {
        const rowTops = tops.value;
        let low = 0;
        let high = Math.max(0, rowTops.length - 2);
        while (low < high) {
            const middle = (low + high + 1) >> 1;
            if ((rowTops[middle] ?? 0) <= y) {
                low = middle;
            } else {
                high = middle - 1;
            }
        }

        return low;
    }

    function reveal(row: number, mode: LogRevealMode) {
        lastReveal = { row, mode };
        applyReveal(row, mode);
    }

    function applyReveal(row: number, mode: LogRevealMode) {
        const top = getRowTop(row);
        const bottom = getRowTop(row + 1);
        const isAbove = top < scrollTop.value + coveredTop.value && scrollTop.value > 0;
        const isBelow = bottom > scrollTop.value + viewportHeight.value;
        // A row taller than the view shows from its top, or stays as it is if it fills the view already.
        const atTop = top - coveredTop.value;
        switch (mode) {
            case 'top':
                moveTo(top);
                break;
            case 'context':
                if (isAbove !== isBelow) {
                    moveTo(Math.min(atTop, bottom - viewportHeight.value * CONTEXT_POSITION));
                }

                break;
            case 'nearest':
                if (isAbove !== isBelow) {
                    moveTo(isAbove ? atTop : Math.min(atTop, bottom - viewportHeight.value));
                }

                break;
        }
    }

    function scrollTo(y: number) {
        lastReveal = null;
        moveTo(y);
    }

    function moveTo(y: number) {
        scrollTop.value = Math.max(0, Math.min(y, totalHeight.value - viewportHeight.value));
    }

    function keepInPlace(change: () => void) {
        const anchor = firstVisible.value;
        const offset = scrollTop.value - getRowTop(anchor);
        change();
        if (lastReveal) {
            applyReveal(lastReveal.row, lastReveal.mode);
        } else {
            moveTo(getRowTop(anchor) + offset);
        }
    }

    function onScroll() {
        const top = element.value?.scrollTop ?? 0;
        // What is scrolled to here on the view's own account comes back through this too.
        if (Math.abs(top - scrollTop.value) >= 1) {
            lastReveal = null;
        }

        scrollTop.value = top;
    }

    function measureViewport(scroller: HTMLElement) {
        keepInPlace(() => {
            viewportHeight.value = scroller.clientHeight;
            viewportWidth.value = scroller.clientWidth;
        });
    }
}
