import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { computed, nextTick, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, ShallowRef } from 'vue';

import { getCursorScroll } from '@/reading/getCursorScroll.js';
import { useHeldKey } from '@/reading/useHeldKey.js';

import type { AnchoredListExposed } from './AnchoredList.vue';
import { estimateReviewRowHeight } from './buildReviewRows.js';
import type { ReviewGapDirection, ReviewRow, ReviewThreadRow } from './buildReviewRows.js';
import { findCursorAfterRows } from './cursor/findCursorAfterRows.js';
import { findCursorOnScreen } from './cursor/findCursorOnScreen.js';
import type { ReviewCommentBox } from './cursor/findCursorOnScreen.js';
import type { IsThreadWhole } from './cursor/listCursorStops.js';
import { moveCursor } from './cursor/moveCursor.js';
import { normalizeCursor } from './cursor/normalizeCursor.js';
import type { ReviewCursor } from './cursor/ReviewCursor.js';
import { walkCursorStops } from './cursor/walkCursorStops.js';

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
    /**
     * What the pointer moves over: its rows name the stop they are part of (`data-cursor-key`), a whole thread's comments
     * theirs (`data-cursor-comment`), whose boxes are measured there.
     */
    diffColumn: MaybeRefOrGetter<HTMLElement | null>;
    /** Every file in the order they show, those not shown too. */
    order: MaybeRefOrGetter<readonly string[]>;
    /** A range is being dragged on the lines' numbers: the pointer moving along them leaves the cursor (D44). */
    isDragging: MaybeRefOrGetter<boolean>;
    /** Whether a thread shows whole, each of its comments then a stop (`isReviewThreadWhole`); reactive reads are tracked. */
    isThreadWhole: IsThreadWhole;
    /** The Code role's line height in pixels (`TypographyStore`): a row not drawn yet is estimated by it. */
    codeLineHeight: MaybeRefOrGetter<number>;
    /** The reader moved the cursor, by a key or the pointer: whatever they were landed on is behind them. */
    onMove: () => void;
}

/** What {@link useReviewCursor} gives. */
export interface ReviewCursorActions {
    /** ↓ ↑: a stop, or more the longer the key is held. */
    move(direction: 1 | -1): void;
    /** PageDown PageUp: the stop about a screen away. */
    page(direction: 1 | -1): void;
    /**
     * A jump put it there, moving nothing itself; a key not among the rows leaves it. A thread shown whole takes the comment
     * asked for, else the one it is already on, else its first; the cursor object stays while it is already there.
     */
    setTo(key: string, comment?: string): void;
    /** The keys took it to that row a step away, as ↓ ↑ do: the diff follows as for them. */
    stepTo(key: string, direction: 1 | -1): void;
    /** A wheel, trackpad or scrollbar scroll of so many pixels, down if positive. */
    followScroll(distance: number): void;
    /** Lines are coming out of a gap that way: the rows they change say where a cursor on it goes. */
    noteExpanding(direction: ReviewGapDirection): void;
    /** The first stop under the pinned header, a comment of a whole thread included; `null` with none on screen. */
    findTop(): ReviewCursor | null;
}

/** Less than a pixel off is wholly on screen: the rows' edges are fractions. */
const SHOWN_TOLERANCE = 1;

/**
 * The diff's line cursor (D44), shared by the pointer and the keys: moving the pointer over a stop puts it there,
 * moving nothing; ↓ ↑ and PageDown PageUp move it, the diff scrolling only to keep it a third of the screen from an edge;
 * a scroll that takes it off the screen brings it to the stop at the edge it left by; rows changing under it leave it on
 * its stop, or the nearest left. A thread shown whole is a stop per comment; folded, or a comment gone, the cursor is put
 * back on a stop of it.
 */
export function useReviewCursor(options: UseReviewCursorOptions): ReviewCursorActions {
    const held = useHeldKey();
    const { cursor, isThreadWhole } = options;

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
                    isThreadWhole,
                });
            }
        },
    );

    /** The thread holding the cursor: folding it or deleting a comment may not change the rows. */
    const cursorThread = computed(() => {
        const key = cursor.value?.key;
        const row = key === undefined ? undefined : toValue(options.rows).find(other => other.key === key);
        return row?.kind === 'thread' ? row : null;
    });
    watch([cursorThread, () => cursorThread.value !== null && isThreadWhole(cursorThread.value)], ([row], [before]) => {
        const current = cursor.value;
        if (!row || !current) {
            return;
        }

        const previousComments =
            before?.key === row.key ? before.placement.thread.comments.map(comment => comment.id) : undefined;
        cursor.value = normalizeCursor({ row, cursor: current, isThreadWhole, previousComments });
    });

    // The window's, for a move into the diff to be told from where the pointer was before.
    onWindowEvent('pointermove', onPointerMove, { passive: true });

    return { move, page, setTo, stepTo, followScroll, noteExpanding, findTop };

    function move(direction: 1 | -1) {
        const from = cursor.value;
        const delta = direction * held.step(direction);
        moveTo(
            from ? moveCursor({ rows: toValue(options.rows), cursor: from, delta, isThreadWhole }) : findTop(),
            direction,
        );
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
        let index = rows.findIndex(row => row.key === from.key);
        // The tops of the rows walked and of their stops, from the cursor's row's top, down positive.
        let rowTop = 0;
        const origin = getStopOffset(list, from);
        let target = from;
        for (const { row, stop } of walkCursorStops({ rows, cursor: from, direction, isThreadWhole })) {
            for (; rows[index] !== row; index += direction) {
                const passed = rows[direction === 1 ? index : index - 1];
                rowTop += direction * (passed ? getRowHeight(list, passed, toValue(options.codeLineHeight)) : 0);
            }

            target = stop;
            if (Math.abs(rowTop + getStopOffset(list, stop) - origin) >= height - covered) {
                break;
            }
        }

        moveTo(target, direction);
    }

    function setTo(key: string, comment?: string) {
        const row = toValue(options.rows).find(other => other.key === key);
        if (!row) {
            return;
        }

        const current = cursor.value;
        const kept = current?.key === key && (comment === undefined || comment === current.comment);
        const asked = kept ? current : comment === undefined ? { key } : { key, comment };
        cursor.value = normalizeCursor({ row, cursor: asked, isThreadWhole });
    }

    function stepTo(key: string, direction: 1 | -1) {
        const row = toValue(options.rows).find(other => other.key === key);
        const target = row
            ? normalizeCursor({ row, cursor: { key }, isThreadWhole, fromBelow: direction === -1 })
            : { key };
        moveTo(target, direction);
    }

    function followScroll(distance: number) {
        const current = cursor.value;
        const list = toValue(options.list);
        if (!current || !list || distance === 0) {
            return;
        }

        const viewport = list.getViewport();
        const shown = list.getShownRows();
        const box =
            (current.comment === undefined ? null : getCommentBox(current.key, current.comment)) ??
            shown.find(({ row }) => row.key === current.key);
        const band = viewport.height - viewport.covered;
        const visible = box ? Math.min(box.bottom, viewport.height) - Math.max(box.top, viewport.covered) : 0;
        if (box && visible >= Math.min(box.bottom - box.top, band) - SHOWN_TOLERANCE) {
            return;
        }

        cursor.value =
            findCursorOnScreen({
                rows: shown,
                viewport,
                edge: distance > 0 ? 'top' : 'bottom',
                isThreadWhole,
                getCommentBox,
            }) ?? current;
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
        scrollToCursor(target, direction === 1 ? 'down' : 'up');
    }

    /**
     * By `jumpTo`, which takes effect at once and is not the user's scroll: the wheel rule stays out of it. On a comment, by
     * the comment's box; in a thread not drawn yet, by the thread's estimate, then once more by the comment once drawn.
     */
    function scrollToCursor(target: ReviewCursor, direction: 'down' | 'up') {
        const list = toValue(options.list);
        if (!list || scrollToDrawn(list, target, direction)) {
            return;
        }

        // Not drawn: where the margin holds it, as if it came in from beyond the edge it goes toward.
        const row = toValue(options.rows).find(other => other.key === target.key);
        if (!row) {
            return;
        }

        const viewport = list.getViewport();
        const height = estimateReviewRowHeight(row, toValue(options.codeLineHeight));
        const top = direction === 'down' ? viewport.height : viewport.covered - height;
        const unbounded = { ...viewport, scrolled: Infinity, remaining: Infinity };
        const distance = getCursorScroll({ top, bottom: top + height, viewport: unbounded, direction });
        list.jumpTo(target.key, top - distance);
        if (target.comment !== undefined) {
            void nextTick(() => {
                if (cursor.value === target) {
                    scrollToDrawn(list, target, direction);
                }
            });
        }
    }

    /** `false` for a row not drawn, nothing done. */
    function scrollToDrawn(list: ReviewCursorList, target: ReviewCursor, direction: 'down' | 'up') {
        const rowBox = list.getRowBox(target.key);
        if (!rowBox) {
            return false;
        }

        const box = (target.comment === undefined ? null : getCommentBox(target.key, target.comment)) ?? rowBox;
        const distance = getCursorScroll({ top: box.top, bottom: box.bottom, viewport: list.getViewport(), direction });
        if (distance !== 0) {
            list.jumpTo(target.key, rowBox.top - distance);
        }

        return true;
    }

    function findTop() {
        const list = toValue(options.list);
        return list
            ? findCursorOnScreen({
                  rows: list.getShownRows(),
                  viewport: list.getViewport(),
                  edge: 'top',
                  isThreadWhole,
                  getCommentBox,
              })
            : null;
    }

    /**
     * A drawn comment's edges from the viewport's top: its offset in its row's element on the row's box, which the list
     * measures below its top room, so never by the scroller's own edges. `null` for one not drawn.
     */
    function getCommentBox(key: string, comment: string): ReviewCommentBox | null {
        const rowBox = toValue(options.list)?.getRowBox(key);
        const rowElement = rowBox && findRowElement(key);
        const commentElement = rowElement?.querySelector(`[data-cursor-comment="${CSS.escape(comment)}"]`);
        if (!rowBox || !rowElement || !commentElement) {
            return null;
        }

        const rowRect = rowElement.getBoundingClientRect();
        const rect = commentElement.getBoundingClientRect();
        return { top: rowBox.top + rect.top - rowRect.top, bottom: rowBox.top + rect.bottom - rowRect.top };
    }

    /** How far below its row's top a stop is: a comment's offset in its thread, 0 for one not drawn and any other stop. */
    function getStopOffset(list: ReviewCursorList, stop: ReviewCursor) {
        const box = stop.comment === undefined ? null : getCommentBox(stop.key, stop.comment);
        const rowBox = box && list.getRowBox(stop.key);
        return box && rowBox ? box.top - rowBox.top : 0;
    }

    /** The row's own element: the pinned header's copy has no key, so a thread's is the only one. */
    function findRowElement(key: string) {
        return toValue(options.diffColumn)?.querySelector(`[data-cursor-key="${CSS.escape(key)}"]`) ?? null;
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

        const rowElement = target.closest('[data-cursor-key]');
        const key = rowElement?.getAttribute('data-cursor-key');
        const row = key ? toValue(options.rows).find(other => other.key === key) : undefined;
        if (!rowElement || !row) {
            return;
        }

        const comment =
            row.kind === 'thread' && isThreadWhole(row)
                ? findPointerComment(row, rowElement, target, event.clientY)
                : undefined;
        const current = cursor.value;
        if (current?.key === row.key && (comment === undefined || comment === current.comment)) {
            return;
        }

        cursor.value = normalizeCursor({
            row,
            cursor: comment === undefined ? { key: row.key } : { key: row.key, comment },
            isThreadWhole,
        });
        options.onMove();
    }

    /**
     * The comment under the pointer in a thread shown whole, by the comment it is in; elsewhere in the thread, its first above
     * the first comment (its head), else its last (its bands, replies on their way, the reply box). `undefined` with no
     * comment drawn.
     */
    function findPointerComment(row: ReviewThreadRow, rowElement: Element, target: Element, y: number) {
        const own = target.closest('[data-cursor-comment]')?.getAttribute('data-cursor-comment');
        if (own) {
            return own;
        }

        const first = rowElement.querySelector('[data-cursor-comment]');
        if (!first) {
            return undefined;
        }

        const { comments } = row.placement.thread;
        return y < first.getBoundingClientRect().top ? comments[0]?.id : comments.at(-1)?.id;
    }
}

function getRowHeight(list: ReviewCursorList, row: ReviewRow, codeLineHeight: number) {
    const box = list.getRowBox(row.key);
    return box ? box.bottom - box.top : estimateReviewRowHeight(row, codeLineHeight);
}
