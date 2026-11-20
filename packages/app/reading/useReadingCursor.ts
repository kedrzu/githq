import { assertValue } from '@nzyme/utils/assert.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onElementScroll } from '@nzyme/vue-utils/onElementScroll.js';
import { onEventEmitter } from '@nzyme/vue-utils/onEventEmitter.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { onScopeDispose, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, ShallowRef } from 'vue';

import { Clock } from '@/services/Clock.js';
import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';

import { buildSegments } from './buildSegments.js';
import { findCursorSegment } from './findCursorSegment.js';
import { findNextComment } from './findNextComment.js';
import { findSegmentAt } from './findSegmentAt.js';
import { findStopOnScreen } from './findStopOnScreen.js';
import { followHeld } from './followHeld.js';
import { followScroll } from './followScroll.js';
import { getCommentScroll } from './getCommentScroll.js';
import { getCursorScroll } from './getCursorScroll.js';
import type { CursorScrollViewport } from './getCursorScroll.js';
import { getHeldLine } from './getHeldLine.js';
import { getSegmentCursor } from './getSegmentCursor.js';
import type { ReadingBand, ReadingCursor, ReadingPlace, ReadingStopBox } from './ReadingCursor.js';
import { LINE_STEP, stepReading } from './stepReading.js';
import { REPEAT_GAP_MS, useHeldKey } from './useHeldKey.js';

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
    /**
     * ↓ ↑ pressed: on to the next segment, or a quarter of the screen's scroll through a tall one (`stepReading`). Held:
     * a smooth scroll, the cursor following a reading line carried with it (`followHeld`). With no stops, a line's
     * scroll, more the longer the key is held.
     */
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
/** How fast a held ↓ ↑ scrolls, in px a second. */
const HELD_SPEED = 500;
/** What marks a stop, its value the key. */
const STOP_ATTRIBUTE = 'data-reading-stop';

/**
 * A reading screen's cursor (D44's, on a scrolling page): a position in the content shown by the stop it is on, the
 * stops being elements marked `data-reading-stop`, with the stops around it (its `path`). A press of ↓ ↑ moves it to the
 * next part of the content, or scrolls a quarter of the screen through a tall one; held, the screen scrolls smoothly and
 * the cursor follows from where it was, as far as the scroll carried it, nothing snapping as the key is released.
 * PageDown PageUp scroll a screen, the cursor keeping its place on it. The pointer moving over a stop (not while an
 * arrow is held) or pressing it, or the focus going into it, puts it there; a scroll that takes its part out of sight
 * brings it to the part at the edge it left by; its stop drawn away (a thread resolved), to the innermost stop around
 * it still there. With no stops the keys only scroll.
 */
export function useReadingCursor(options: UseReadingCursorOptions): ReadingCursorActions {
    const clock = useService(Clock);
    const held = useHeldKey();
    const { cursor } = options;
    const withStops = options.stops ?? true;

    let lastPointer: { x: number; y: number } | null = null;
    let lastScroll: { element: HTMLElement; top: number } | null = null;
    let pressing = false;
    let hold: Hold | null = null;

    onElementScroll(() => toValue(options.scroller), onScroll);
    onEventEmitter(held.released, stopHold);
    onScopeDispose(stopHold);
    // The content drawn again (a thread resolved or hidden, a comment loading): the path read again, once a frame.
    watch(
        () => (withStops ? toValue(options.scroller) : null),
        (scroller, _previous, onCleanup) => {
            if (!scroller) {
                return;
            }

            let frame: number | null = null;
            const observer = new MutationObserver(() => {
                frame ??= requestAnimationFrame(() => {
                    frame = null;
                    refreshPath(scroller);
                });
            });
            observer.observe(scroller, { childList: true, subtree: true });
            onCleanup(() => {
                observer.disconnect();
                if (frame !== null) {
                    cancelAnimationFrame(frame);
                }
            });
        },
        { immediate: true },
    );
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

        const stops = withStops ? measureStops(scroller) : [];
        if (stops.length === 0) {
            scroller.scrollBy({ top: direction * held.step(direction) * LINE_STEP, behavior: 'instant' });
            return;
        }

        if (held.isRepeat(direction)) {
            keepHolding(scroller, direction, stops);
            return;
        }

        stopHold();
        const band = getBand(scroller);
        const segments = buildSegments(stops);
        const current = cursor.value ? findCursorSegment({ segments, stops, cursor: cursor.value }) : null;
        if (!current) {
            // Nowhere yet, or its stop gone: the first press lands on what shows at the top.
            setCursor(findStopOnScreen({ stops, band, edge: 'top' }));
            return;
        }

        const { segment, scroll } = stepReading({
            segments,
            current,
            band,
            viewport: getViewport(scroller),
            direction: direction === 1 ? 'down' : 'up',
        });
        if (segment !== current) {
            setCursor(getSegmentCursor({ stops, segment }));
        }

        if (scroll !== 0) {
            scroller.scrollBy({ top: scroll, behavior: 'instant' });
        }
    }

    /** A repeat of the held arrow: the smooth scroll started by the first one, kept going by the rest. */
    function keepHolding(scroller: HTMLElement, direction: 1 | -1, stops: readonly ReadingStopBox[]) {
        const now = clock.now();
        if (hold?.scroller === scroller && hold.direction === direction) {
            hold.lastRepeat = now;
            return;
        }

        stopHold();
        const band = getBand(scroller);
        const current = cursor.value
            ? findCursorSegment({ segments: buildSegments(stops), stops, cursor: cursor.value })
            : null;
        if (!current) {
            setCursor(findStopOnScreen({ stops, band, edge: 'top' }));
            return;
        }

        hold = {
            scroller,
            direction,
            line: getHeldLine({ segment: current, band, direction: direction === 1 ? 'down' : 'up' }),
            lastFrame: now,
            lastRepeat: now,
            frame: requestAnimationFrame(scrollHeld),
        };
    }

    /**
     * A frame of the held arrow's scroll: by the time since the last one, the reading line carried as far — on past the
     * content's ends, where the scroll stops, so the cursor still reaches the last stops — and the cursor following it.
     */
    function scrollHeld() {
        const current = hold;
        if (!current) {
            return;
        }

        const now = clock.now();
        const { scroller, direction } = current;
        // No repeat for a while is a release that never came (the keyup went elsewhere).
        if (now - current.lastRepeat > REPEAT_GAP_MS || getActiveScroller() !== scroller) {
            stopHold();
            return;
        }

        const from = current.line;
        current.line += (direction * HELD_SPEED * (now - current.lastFrame)) / 1000;
        current.lastFrame = now;
        // By whole pixels between the line's rounded places, so what scrolls never drifts from the line.
        const distance = Math.round(current.line) - Math.round(from);
        if (distance !== 0) {
            scroller.scrollBy({ top: distance, behavior: 'instant' });
        }

        const stops = measureStops(scroller);
        const segments = buildSegments(stops);
        const at = cursor.value ? findCursorSegment({ segments, stops, cursor: cursor.value }) : null;
        if (at) {
            const next = followHeld({
                segments,
                line: current.line,
                direction: direction === 1 ? 'down' : 'up',
                current: at,
            });
            if (next !== at) {
                setCursor(getSegmentCursor({ stops, segment: next }));
            }
        }

        current.frame = requestAnimationFrame(scrollHeld);
    }

    /** The held arrow's scroll ends where it is; the cursor stays where it followed it to. */
    function stopHold() {
        if (hold) {
            cancelAnimationFrame(hold.frame);
            hold = null;
        }
    }

    /** A screen's scroll, the cursor on the segment at its place on the screen it leaves, kept in sight. */
    function page(direction: 1 | -1) {
        stopHold();
        const scroller = getActiveScroller();
        if (!scroller) {
            return;
        }

        const band = getBand(scroller);
        const distance = direction * Math.max(band.bottom - band.top - PAGE_OVERLAP, LINE_STEP);
        const stops = withStops ? measureStops(scroller) : [];
        if (stops.length === 0) {
            scroller.scrollBy({ top: distance, behavior: 'instant' });
            return;
        }

        const from = getCursorY(stops);
        if (from === null) {
            setCursor(findStopOnScreen({ stops, band, edge: 'top' }));
            return;
        }

        const segment = findSegmentAt(buildSegments(stops), from + distance);
        if (!segment) {
            return;
        }

        setCursor(getSegmentCursor({ stops, segment, y: from + distance }));
        scroller.scrollBy({ top: distance, behavior: 'instant' });
        scrollToCursor(scroller, getCursorY(stops) ?? from, direction);
    }

    function stepComment(direction: 1 | -1) {
        stopHold();
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

        setCursor({ key: next.key, offset: 0 });
        const viewport = getViewport(scroller);
        const distance = getCommentScroll(next.top - viewport.scrolled, viewport);
        if (distance !== 0) {
            scroller.scrollBy({ top: distance, behavior: 'instant' });
        }

        return true;
    }

    function setTo(key: string) {
        setCursor({ key, offset: 0 });
    }

    function setToTop() {
        const scroller = toValue(options.scroller);
        if (scroller && withStops) {
            setCursor(findStopOnScreen({ stops: measureStops(scroller), band: getBand(scroller), edge: 'top' }));
        }
    }

    /** Every move of the cursor: onto the place, with the stops around it as the page has them now. */
    function setCursor(place: ReadingPlace | null) {
        const scroller = toValue(options.scroller);
        cursor.value = place && { ...place, path: scroller ? readPath(scroller, place.key) : [place.key] };
    }

    /**
     * The content drawn again: the path read again, and with the cursor's stop gone, the cursor on the innermost stop of
     * its old path still there (the row a resolved thread folds to), so no mark is left on what is not drawn.
     */
    function refreshPath(scroller: HTMLElement) {
        const current = cursor.value;
        const key = current?.path.find(other => findStop(scroller, other) !== null);
        if (!current || key === undefined) {
            return;
        }

        if (key !== current.key) {
            setCursor({ key, offset: 0 });
            return;
        }

        const path = readPath(scroller, key);
        if (path.length !== current.path.length || path.some((other, index) => other !== current.path[index])) {
            setCursor(current);
        }
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
        // A held arrow's own scroll: the cursor follows its reading line instead.
        if (!current || distance === 0 || !withStops || !toValue(options.isActive) || hold) {
            return;
        }

        const stops = measureStops(scroller);
        const next = followScroll({
            segments: buildSegments(stops),
            stops,
            cursor: current,
            band: getBand(scroller),
            direction: distance > 0 ? 'down' : 'up',
        });
        if (next !== current) {
            setCursor(next);
        }
    }

    function onPointerMove(event: PointerEvent) {
        const still = !lastPointer || (lastPointer.x === event.clientX && lastPointer.y === event.clientY);
        lastPointer = { x: event.clientX, y: event.clientY };
        // Content scrolling or showing up under a pointer that stays put moves nothing: the browser's own moves after a
        // layout say where it is, and the first event known is no move at all. Nor does a held arrow's scroll under it.
        if (!still && !hold) {
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
            setCursor({ key: getStopKey(stop), offset: Math.max(offset, 0) });
        }
    }

    function putAtPointer(event: PointerEvent) {
        const stop = findStopElement(event.target);
        if (stop) {
            const key = getStopKey(stop);
            const offset = Math.max(event.clientY - stop.getBoundingClientRect().top, 0);
            if (key !== cursor.value?.key || offset !== cursor.value.offset) {
                setCursor({ key, offset });
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

/** A held arrow's smooth scroll, going while its repeats come. */
interface Hold {
    readonly scroller: HTMLElement;
    readonly direction: 1 | -1;
    /** The reading line the cursor follows, from the content's top (`getHeldLine`, `followHeld`). */
    line: number;
    lastFrame: number;
    lastRepeat: number;
    frame: number;
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

/**
 * The keys of the stop keyed so and of every stop around it in the scroller, its own first, the outermost last. Just its
 * own with it not drawn.
 */
function readPath(scroller: HTMLElement, key: string): string[] {
    const path = [key];
    let stop = findStop(scroller, key)?.parentElement?.closest(`[${STOP_ATTRIBUTE}]`) ?? null;
    while (stop && scroller.contains(stop)) {
        path.push(getStopKey(stop));
        stop = stop.parentElement?.closest(`[${STOP_ATTRIBUTE}]`) ?? null;
    }

    return path;
}

function findStop(scroller: HTMLElement, key: string) {
    return scroller.querySelector(`[${STOP_ATTRIBUTE}="${CSS.escape(key)}"]`);
}

function getStopKey(stop: Element) {
    return assertValue(stop.getAttribute(STOP_ATTRIBUTE));
}
