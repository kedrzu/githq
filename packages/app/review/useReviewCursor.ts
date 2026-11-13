import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { toValue, watch } from 'vue';
import type { MaybeRefOrGetter, ShallowRef } from 'vue';

import { Clock } from '@/services/Clock.js';

import type { AnchoredListExposed } from './AnchoredList.vue';
import { estimateReviewRowHeight } from './buildReviewRows.js';
import type { ReviewGapDirection, ReviewRow } from './buildReviewRows.js';
import { findCursorAfterRows } from './cursor/findCursorAfterRows.js';
import { findCursorOnScreen } from './cursor/findCursorOnScreen.js';
import { getCursorScroll } from './cursor/getCursorScroll.js';
import { getCursorStep } from './cursor/getCursorStep.js';
import { isCursorStop } from './cursor/isCursorStop.js';
import { moveCursor } from './cursor/moveCursor.js';
import type { ReviewCursor } from './cursor/ReviewCursor.js';

/** What {@link useReviewCursor} needs of the list. */
export type ReviewCursorList = Pick<
    AnchoredListExposed<ReviewRow>,
    'jumpTo' | 'getRowBox' | 'getViewport' | 'getShownRows'
>;

/** Options of {@link useReviewCursor}. */
export interface UseReviewCursorOptions {
    /**
     * Where the cursor is, `null` until the review has landed or the reader moved it, and with no stop left. The caller's,
     * for the current file it decides to be known before the rows it orders are built.
     */
    cursor: ShallowRef<ReviewCursor | null>;
    list: MaybeRefOrGetter<ReviewCursorList | null>;
    rows: MaybeRefOrGetter<readonly ReviewRow[]>;
    /** What the pointer moves over: its rows name the stop they are part of (`data-cursor-key`). */
    diffColumn: MaybeRefOrGetter<HTMLElement | null>;
    /** Every file in the order they show, those not shown too. */
    order: MaybeRefOrGetter<readonly string[]>;
    /** A range is being dragged on the lines' numbers: the pointer moving along them leaves the cursor (D44). */
    isDragging: MaybeRefOrGetter<boolean>;
    /** The reader moved the cursor, by a key or the pointer: whatever they were landed on is behind them. */
    onMove: () => void;
}

/** What {@link useReviewCursor} gives. */
export interface ReviewCursorActions {
    /** ↓ ↑: a stop, or more the longer the key is held. */
    move(direction: 1 | -1): void;
    /** PageDown PageUp: the stop about a screen away. */
    page(direction: 1 | -1): void;
    /** A jump put it there, moving nothing itself; a key not among the rows leaves it. */
    setTo(key: string): void;
    /** The keys took it to that row a step away, as ↓ ↑ do: the diff follows as for them. */
    stepTo(key: string, direction: 1 | -1): void;
    /** A wheel, trackpad or scrollbar scroll of so many pixels, down if positive. */
    followScroll(distance: number): void;
    /** Lines are coming out of a gap that way: the rows they change say where a cursor on it goes. */
    noteExpanding(direction: ReviewGapDirection): void;
}

/** A run of the arrow later than this after the previous one is a new press, not its key's repeat. */
const HOLD_GAP_MS = 150;
/** Less than a pixel off is wholly on screen: the rows' edges are fractions. */
const SHOWN_TOLERANCE = 1;

/**
 * The diff's line cursor (D44), shared by the pointer and the keys: moving the pointer over a stop puts it there,
 * moving nothing; ↓ ↑ and PageDown PageUp move it, the diff scrolling only to keep it a third of the screen from an edge;
 * a scroll that takes it off the screen brings it to the stop at the edge it left by; rows changing under it leave it on
 * its stop, or the nearest left.
 */
export function useReviewCursor(options: UseReviewCursorOptions): ReviewCursorActions {
    const clock = useService(Clock);
    const { cursor } = options;

    /** Since when the arrow has been held, `null` with none. */
    let heldSince: number | null = null;
    let heldDirection: 1 | -1 = 1;
    let lastRun = 0;
    let lastPointer: { x: number; y: number } | null = null;
    let expanding: ReviewGapDirection | null = null;

    watch(
        () => toValue(options.rows),
        (next, previous) => {
            const expanded = expanding;
            expanding = null;
            const current = cursor.value;
            if (current) {
                cursor.value = findCursorAfterRows({
                    previous,
                    next,
                    cursor: current,
                    order: toValue(options.order),
                    expanded,
                });
            }
        },
    );

    // The window's, for a move into the diff to be told from where the pointer was before.
    onWindowEvent('pointermove', onPointerMove, { passive: true });

    // Commands are told nothing of the key: its release, or the window losing it (⌘Tab), ends the hold.
    onWindowEvent('keyup', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            heldSince = null;
        }
    });
    onWindowEvent('blur', () => {
        heldSince = null;
    });

    return { move, page, setTo, stepTo, followScroll, noteExpanding };

    function move(direction: 1 | -1) {
        const now = clock.now();
        if (heldSince === null || direction !== heldDirection || now - lastRun > HOLD_GAP_MS) {
            heldSince = now;
            heldDirection = direction;
        }

        lastRun = now;
        const from = cursor.value;
        const delta = direction * getCursorStep(now - heldSince);
        moveTo(from ? moveCursor({ rows: toValue(options.rows), cursor: from, delta }) : findTop(), direction);
    }

    function page(direction: 1 | -1) {
        const list = toValue(options.list);
        const from = cursor.value;
        if (!from || !list) {
            moveTo(findTop(), direction);
            return;
        }

        const rows = toValue(options.rows);
        const { height, covered } = list.getViewport();
        const start = rows.findIndex(row => row.key === from.key);
        if (start === -1) {
            return;
        }

        let target = from;
        let travelled = 0;
        for (let index = start + direction; index >= 0 && index < rows.length; index += direction) {
            const row = rows[index];
            const passed = direction === 1 ? rows[index - 1] : row;
            travelled += passed ? getRowHeight(list, passed) : 0;
            if (row && isCursorStop(row)) {
                target = { key: row.key };
                if (travelled >= height - covered) {
                    break;
                }
            }
        }

        moveTo(target, direction);
    }

    function setTo(key: string) {
        if (toValue(options.rows).some(row => row.key === key)) {
            cursor.value = { key };
        }
    }

    function stepTo(key: string, direction: 1 | -1) {
        moveTo({ key }, direction);
    }

    function followScroll(distance: number) {
        const current = cursor.value;
        const list = toValue(options.list);
        if (!current || !list || distance === 0) {
            return;
        }

        const viewport = list.getViewport();
        const shown = list.getShownRows();
        const box = shown.find(({ row }) => row.key === current.key);
        const band = viewport.height - viewport.covered;
        const visible = box ? Math.min(box.bottom, viewport.height) - Math.max(box.top, viewport.covered) : 0;
        if (box && visible >= Math.min(box.bottom - box.top, band) - SHOWN_TOLERANCE) {
            return;
        }

        cursor.value = findCursorOnScreen({ rows: shown, viewport, edge: distance > 0 ? 'top' : 'bottom' }) ?? current;
    }

    function noteExpanding(direction: ReviewGapDirection) {
        expanding = direction;
    }

    /** The reader's own move: the cursor there and in sight, a third of the screen from the edge it goes toward. */
    function moveTo(target: ReviewCursor | null, direction: 1 | -1) {
        if (!target) {
            return;
        }

        cursor.value = target;
        options.onMove();
        scrollToCursor(target.key, direction === 1 ? 'down' : 'up');
    }

    /** By `jumpTo`, which takes effect at once and is not the user's scroll: the wheel rule stays out of it. */
    function scrollToCursor(key: string, direction: 'down' | 'up') {
        const list = toValue(options.list);
        if (!list) {
            return;
        }

        const viewport = list.getViewport();
        const box = list.getRowBox(key);
        if (box) {
            const distance = getCursorScroll({ top: box.top, bottom: box.bottom, viewport, direction });
            if (distance !== 0) {
                list.jumpTo(key, box.top - distance);
            }

            return;
        }

        // Not drawn: where the margin holds it, as if it came in from beyond the edge it goes toward.
        const row = toValue(options.rows).find(other => other.key === key);
        if (!row) {
            return;
        }

        const height = estimateReviewRowHeight(row);
        const top = direction === 'down' ? viewport.height : viewport.covered - height;
        const unbounded = { ...viewport, scrolled: Infinity, remaining: Infinity };
        const distance = getCursorScroll({ top, bottom: top + height, viewport: unbounded, direction });
        list.jumpTo(key, top - distance);
    }

    function findTop() {
        const list = toValue(options.list);
        return list
            ? findCursorOnScreen({ rows: list.getShownRows(), viewport: list.getViewport(), edge: 'top' })
            : null;
    }

    function onPointerMove(event: PointerEvent) {
        const still = !lastPointer || (lastPointer.x === event.clientX && lastPointer.y === event.clientY);
        lastPointer = { x: event.clientX, y: event.clientY };
        // Rows scrolling or showing up under a pointer that stays put move nothing: the browser's own moves after a layout
        // say where it is, and the first event known is no move at all.
        const { target } = event;
        if (
            still ||
            toValue(options.isDragging) ||
            !(target instanceof Element) ||
            !toValue(options.diffColumn)?.contains(target)
        ) {
            return;
        }

        const key = target.closest('[data-cursor-key]')?.getAttribute('data-cursor-key');
        if (key && key !== cursor.value?.key && toValue(options.rows).some(row => row.key === key)) {
            cursor.value = { key };
            options.onMove();
        }
    }
}

function getRowHeight(list: ReviewCursorList, row: ReviewRow) {
    const box = list.getRowBox(row.key);
    return box ? box.bottom - box.top : estimateReviewRowHeight(row);
}
