import { assertValue } from '@nzyme/utils/assert.js';
import { onElementScroll } from '@nzyme/vue-utils/onElementScroll.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { toValue } from 'vue';
import type { MaybeRefOrGetter, ShallowRef } from 'vue';

import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';

import { findNextComment } from './findNextComment.js';
import { findStopAt } from './findStopAt.js';
import { findStopOnScreen } from './findStopOnScreen.js';
import { followScroll } from './followScroll.js';
import { getCommentScroll } from './getCommentScroll.js';
import { getCursorScroll } from './getCursorScroll.js';
import type { CursorScrollViewport } from './getCursorScroll.js';
import type { ReadingBand, ReadingCursor, ReadingStopBox } from './ReadingCursor.js';
import { LINE_STEP, stepCursor } from './stepCursor.js';
import { useHeldKey } from './useHeldKey.js';

/** Options of {@link useReadingCursor}. */
export interface UseReadingCursorOptions {
    /** What scrolls; it may change (the item swaps containers at a width), the cursor following. */
    scroller: MaybeRefOrGetter<HTMLElement | null>;
    /** The caller's, for the stops to be marked through `provideReadingCursor`. `null` until set or moved. */
    cursor: ShallowRef<ReadingCursor | null>;
    /** `false`: no cursor, ↓ ↑ PageDown PageUp only scroll (a screen with nothing to stop on). Default `true`. */
    stops?: boolean;
    /** While `false`, every listener and key does nothing (the item in a panel, on a phone). */
    isActive: MaybeRefOrGetter<boolean>;
    /** How far down from the scroller's top a pinned header covers it, in px. */
    covered?: MaybeRefOrGetter<number>;
    /** How far up from the scroller's bottom something docked covers it (the item's composer), in px. */
    coveredBottom?: MaybeRefOrGetter<number>;
}

/** What {@link useReadingCursor} gives, for the screen to bind its keys to. */
export interface ReadingCursorActions {
    /** ↓ ↑: a short step, further the longer the key is held, never past a stop's start. */
    move(direction: 1 | -1): void;
    /** PageDown PageUp: a screen. */
    page(direction: 1 | -1): void;
    /**
     * `[` `]`: to the start of the next or previous comment, scrolled into the band. `false` at the ends, moving
     * nothing, so the screen can open what is folded there.
     */
    stepComment(direction: 1 | -1): boolean;
    /** Onto the stop's start, not scrolling: a jump the screen made (a linked comment). */
    setTo(key: string): void;
    /** Onto the first stop at the top of what shows, not scrolling: where a screen opens with no linked comment. */
    setToTop(): void;
}

/** What PageDown PageUp keep in sight of the screen they leave. */
const PAGE_OVERLAP = LINE_STEP;
/** What marks a stop, its value the key. */
const STOP_ATTRIBUTE = 'data-reading-stop';

/**
 * A reading screen's cursor (D44's, on a scrolling page): a position in the content shown by the stop it is on, the
 * stops being elements marked `data-reading-stop`. ↓ ↑ and PageDown PageUp move it, the screen scrolling only to keep
 * it a third of what shows from an edge; the pointer moving over a stop or pressing it, or the focus going into it, puts
 * it there; a scroll that takes its stop out of sight brings it to the stop at the edge it left by. With no stops the
 * keys only scroll.
 */
export function useReadingCursor(options: UseReadingCursorOptions): ReadingCursorActions {
    const held = useHeldKey();
    const { cursor } = options;
    const withStops = options.stops ?? true;

    let lastPointer: { x: number; y: number } | null = null;
    let lastScroll: { element: HTMLElement; top: number } | null = null;
    let pressing = false;

    onElementScroll(() => toValue(options.scroller), onScroll);
    // The window's, for a move into the content to be told from where the pointer was before.
    onWindowEvent('pointermove', onPointerMove, { passive: true });
    onWindowEvent('pointerdown', onPointerDown, { passive: true });
    onWindowEvent('pointerup', endPress, { passive: true });
    onWindowEvent('pointercancel', endPress, { passive: true });
    onWindowEvent('focusin', onFocusIn);

    return { move, page, stepComment, setTo, setToTop };

    function move(direction: 1 | -1) {
        const scroller = getActiveScroller();
        if (!scroller) {
            return;
        }

        const distance = direction * held.step(direction) * LINE_STEP;
        travel(scroller, distance, 'line');
    }

    function page(direction: 1 | -1) {
        const scroller = getActiveScroller();
        if (!scroller) {
            return;
        }

        const band = getBand(scroller);
        travel(scroller, direction * Math.max(band.bottom - band.top - PAGE_OVERLAP, LINE_STEP), 'page');
    }

    function stepComment(direction: 1 | -1) {
        const scroller = getActiveScroller();
        if (!scroller || !withStops) {
            return false;
        }

        const stops = measureStops(scroller);
        const from = findCursorStop(stops) ?? findStopOnScreen({ stops, band: getBand(scroller), edge: 'top' });
        const next = from ? findNextComment({ stops, key: from.key, direction }) : null;
        if (!next) {
            return false;
        }

        cursor.value = { key: next.key, offset: 0 };
        const viewport = getViewport(scroller);
        const distance = getCommentScroll(next.top - viewport.scrolled, viewport);
        if (distance !== 0) {
            scroller.scrollBy({ top: distance, behavior: 'instant' });
        }

        return true;
    }

    function setTo(key: string) {
        cursor.value = { key, offset: 0 };
    }

    function setToTop() {
        const scroller = toValue(options.scroller);
        if (scroller && withStops) {
            cursor.value = findStopOnScreen({ stops: measureStops(scroller), band: getBand(scroller), edge: 'top' });
        }
    }

    /** The reader's own move: the cursor so far on and in sight, a third of the band from the edge it goes toward. */
    function travel(scroller: HTMLElement, distance: number, by: 'line' | 'page') {
        const stops = withStops ? measureStops(scroller) : [];
        const band = getBand(scroller);
        if (stops.length === 0) {
            scroller.scrollBy({ top: distance, behavior: 'instant' });
            return;
        }

        const from = getCursorY(stops);
        if (from === null) {
            // Nowhere yet, or its stop gone: the first press lands on what shows at the top.
            cursor.value = findStopOnScreen({ stops, band, edge: 'top' });
            return;
        }

        const y = stepCursor({ stops, y: from, distance, by });
        const stop = findStopAt(stops, y);
        if (!stop) {
            return;
        }

        cursor.value = { key: stop.key, offset: y - stop.top };
        if (by === 'page') {
            // A screen's travel scrolls a screen, the cursor keeping its place on it.
            scroller.scrollBy({ top: y - from, behavior: 'instant' });
        }

        scrollToCursor(scroller, y, distance > 0 ? 1 : -1);
    }

    /** By `scrollBy`, at once: the cursor's line, at `y` from the content's top, kept a third of the band from the edge it goes toward. */
    function scrollToCursor(scroller: HTMLElement, y: number, direction: 1 | -1) {
        const viewport = getViewport(scroller);
        const top = y - viewport.scrolled;
        const distance = getCursorScroll({
            top,
            bottom: top + LINE_STEP,
            viewport,
            direction: direction === 1 ? 'down' : 'up',
        });
        if (distance !== 0) {
            scroller.scrollBy({ top: distance, behavior: 'instant' });
        }
    }

    function getCursorY(stops: readonly ReadingStopBox[]) {
        const current = cursor.value;
        const stop = findCursorStop(stops);
        return current && stop ? stop.top + Math.min(current.offset, stop.bottom - stop.top - 1) : null;
    }

    function findCursorStop(stops: readonly ReadingStopBox[]) {
        const key = cursor.value?.key;
        return key === undefined ? null : (stops.find(stop => stop.key === key) ?? null);
    }

    function getActiveScroller() {
        return toValue(options.isActive) ? toValue(options.scroller) : null;
    }

    function getViewport(scroller: HTMLElement): CursorScrollViewport {
        const scrolled = scroller.scrollTop;
        return {
            height: scroller.clientHeight - (toValue(options.coveredBottom) ?? 0),
            covered: toValue(options.covered) ?? 0,
            scrolled,
            remaining: scroller.scrollHeight - scroller.clientHeight - scrolled,
        };
    }

    function getBand(scroller: HTMLElement): ReadingBand {
        const top = scroller.scrollTop;
        return {
            top: top + (toValue(options.covered) ?? 0),
            bottom: top + scroller.clientHeight - (toValue(options.coveredBottom) ?? 0),
        };
    }

    function onScroll() {
        const scroller = toValue(options.scroller);
        if (!scroller) {
            return;
        }

        const previous = lastScroll?.element === scroller ? lastScroll.top : scroller.scrollTop;
        lastScroll = { element: scroller, top: scroller.scrollTop };
        const current = cursor.value;
        const distance = scroller.scrollTop - previous;
        if (!current || distance === 0 || !withStops || !toValue(options.isActive)) {
            return;
        }

        const next = followScroll({
            stops: measureStops(scroller),
            cursor: current,
            band: getBand(scroller),
            direction: distance > 0 ? 'down' : 'up',
        });
        if (next !== current) {
            cursor.value = next;
        }
    }

    function onPointerMove(event: PointerEvent) {
        const still = !lastPointer || (lastPointer.x === event.clientX && lastPointer.y === event.clientY);
        lastPointer = { x: event.clientX, y: event.clientY };
        // Content scrolling or showing up under a pointer that stays put moves nothing: the browser's own moves after a
        // layout say where it is, and the first event known is no move at all.
        if (!still) {
            putAtPointer(event);
        }
    }

    function onPointerDown(event: PointerEvent) {
        pressing = true;
        // A press on a link, a button or a field is about that, not about where the reader is.
        if (!isActivatableTarget(event.target) && !isEditableTarget(event.target)) {
            putAtPointer(event);
        }
    }

    function endPress() {
        pressing = false;
    }

    function onFocusIn(event: FocusEvent) {
        // A press already decided, and a press on a button focuses it.
        const { target } = event;
        const stop = pressing ? null : findStopElement(target);
        if (stop && target instanceof Element) {
            const offset = target.getBoundingClientRect().top - stop.getBoundingClientRect().top;
            cursor.value = { key: getStopKey(stop), offset: Math.max(offset, 0) };
        }
    }

    function putAtPointer(event: PointerEvent) {
        const stop = findStopElement(event.target);
        if (stop) {
            const key = getStopKey(stop);
            const offset = Math.max(event.clientY - stop.getBoundingClientRect().top, 0);
            if (key !== cursor.value?.key || offset !== cursor.value.offset) {
                cursor.value = { key, offset };
            }
        }
    }

    /** The innermost stop around a target in the scroller, while the cursor is live. */
    function findStopElement(target: EventTarget | null) {
        const scroller = withStops ? getActiveScroller() : null;
        if (!scroller || !(target instanceof Element) || !scroller.contains(target)) {
            return null;
        }

        const stop = target.closest(`[${STOP_ATTRIBUTE}]`);
        return stop && scroller.contains(stop) ? stop : null;
    }
}

/** Every stop in the scroller, in document order, from the content's top; a stop not laid out (hidden) is none. */
function measureStops(scroller: HTMLElement): ReadingStopBox[] {
    const origin = scroller.getBoundingClientRect().top + scroller.clientTop - scroller.scrollTop;
    const stops: ReadingStopBox[] = [];
    for (const element of scroller.querySelectorAll(`[${STOP_ATTRIBUTE}]`)) {
        const box = element.getBoundingClientRect();
        if (box.height > 0) {
            stops.push({
                key: getStopKey(element),
                kind: element.getAttribute('data-reading-stop-kind') === 'comment' ? 'comment' : 'row',
                top: box.top - origin,
                bottom: box.bottom - origin,
            });
        }
    }

    return stops;
}

function getStopKey(stop: Element) {
    return assertValue(stop.getAttribute(STOP_ATTRIBUTE));
}
