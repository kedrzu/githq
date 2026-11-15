import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { onScopeDispose, ref, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';

/**
 * How far from the screen's left edge a swipe may not start: there the browser takes it for its back gesture (mobile
 * D2).
 */
const EDGE_ZONE = 24;
/** How far a finger moves before the gesture is told horizontal (the row's) or vertical (the list's scroll). */
const SLOP = 8;
/** How long the row takes to slide back, as `$motion-open`: its actions are put away after it. */
const SETTLE_MS = 150;

/** What {@link useRowSwipe} swipes. */
export interface UseRowSwipeOptions {
    /** Rows may be swiped now: the phone layout, a list whose rows have actions. */
    readonly enabled: MaybeRefOrGetter<boolean>;
    /** Whether the row of `key` has actions to reveal. */
    canSwipe(key: string): boolean;
    /** The list: a tap in it that closes an open row opens nothing else. */
    readonly body: Readonly<Ref<HTMLElement | null>>;
    /** A menu at the bottom is open (`PhoneLayout.taskOpen`): a tap in it leaves the row open. */
    taskOpen(): boolean;
}

/** The row swiped, and how far. */
export interface RowSwipeViewModel {
    /** The row whose actions are shown (being swiped, open, or sliding back); `null` for none. */
    readonly key: string | null;
    /** How far it is slid, in px: 0 or less. */
    readonly offset: number;
    /** A finger is moving it: no transition. */
    readonly dragging: boolean;
    /** It rests open, its actions revealed. */
    readonly open: boolean;
    /** A pointer went down on the row of `key`. */
    start(event: PointerEvent, key: string): void;
    /** A click in the list, captured: swallowed when it ended a swipe or closed an open row. */
    swallowClick(event: MouseEvent): void;
    /** Slides the row back. */
    close(): void;
    /** Puts the row away at once (it left the list). */
    reset(): void;
}

/** A pointer down on a row, until it is told what it is. */
interface Gesture {
    readonly pointerId: number;
    readonly row: HTMLElement;
    readonly key: string;
    readonly startX: number;
    readonly startY: number;
    /** Where the row stood when it began: open or not. */
    readonly base: number;
    /** `null` until it moved past {@link SLOP}. */
    horizontal: boolean | null;
}

/**
 * Swiping a list row left on a phone to reveal its actions at its right end (mobile D27): by touch or a pen, never a
 * mouse; the row follows the finger, past a third of its actions it stays open, short of it springs back, and swiped
 * right it closes. A vertical move is the list's scroll, which the browser keeps (`touch-action: pan-y` on the rows).
 * One row is open at a time: another one's swipe or a tap anywhere else closes it — the tap opening nothing — but not
 * while a menu at the bottom is open over it (`taskOpen`). Never from the screen's left edge (D2).
 */
export function useRowSwipe(options: UseRowSwipeOptions): RowSwipeViewModel {
    const key = ref<string | null>(null);
    const offset = ref(0);
    const dragging = ref(false);
    const open = ref(false);
    let gesture: Gesture | null = null;
    let swallowing = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    onWindowEvent('pointerdown', closeOnTapElsewhere, { capture: true });
    onWindowEvent('pointermove', move);
    onWindowEvent('pointerup', end);
    onWindowEvent('pointercancel', end);
    watch(
        () => toValue(options.enabled),
        enabled => {
            if (!enabled) {
                reset();
            }
        },
    );
    onScopeDispose(clearSettle);

    return reactive<RowSwipeViewModel>({ key, offset, dragging, open, start, swallowClick, close, reset });

    function start(event: PointerEvent, rowKey: string) {
        if (
            !toValue(options.enabled) ||
            event.pointerType === 'mouse' ||
            !event.isPrimary ||
            event.clientX < EDGE_ZONE ||
            !options.canSwipe(rowKey) ||
            !(event.currentTarget instanceof HTMLElement)
        ) {
            return;
        }

        gesture = {
            pointerId: event.pointerId,
            row: event.currentTarget,
            key: rowKey,
            startX: event.clientX,
            startY: event.clientY,
            base: key.value === rowKey ? offset.value : 0,
            horizontal: null,
        };
    }

    function move(event: PointerEvent) {
        if (!gesture || event.pointerId !== gesture.pointerId) {
            return;
        }

        const dx = event.clientX - gesture.startX;
        const dy = event.clientY - gesture.startY;
        if (gesture.horizontal === null) {
            if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) {
                return;
            }

            gesture.horizontal = Math.abs(dx) > Math.abs(dy);
            if (!gesture.horizontal) {
                gesture = null;
                return;
            }

            clearSettle();
            if (key.value !== gesture.key) {
                key.value = gesture.key;
                open.value = false;
            }

            dragging.value = true;
        }

        offset.value = Math.min(0, Math.max(-measure(gesture.row), gesture.base + dx));
    }

    function end(event: PointerEvent) {
        if (!gesture || event.pointerId !== gesture.pointerId) {
            return;
        }

        const { horizontal, base, row } = gesture;
        gesture = null;
        if (!horizontal) {
            return;
        }

        dragging.value = false;
        // The click a swipe ends with opens nothing.
        swallowing = event.type === 'pointerup';
        const width = measure(row);
        // From closed it opens past a third of its actions; from open it closes past a third back.
        const threshold = base === 0 ? width / 3 : (width * 2) / 3;
        if (width > 0 && -offset.value > threshold) {
            offset.value = -width;
            open.value = true;
        } else {
            close();
        }
    }

    /** A pointer down anywhere: an open row closes unless it is on its actions, or a menu at the bottom is open. */
    function closeOnTapElsewhere(event: PointerEvent) {
        swallowing = false;
        if (key.value === null || !open.value || options.taskOpen()) {
            return;
        }

        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-row-swipe-actions]')) {
            return;
        }

        close();
        swallowing = target !== null && options.body.value?.contains(target) === true;
    }

    function swallowClick(event: MouseEvent) {
        if (swallowing) {
            swallowing = false;
            event.preventDefault();
            event.stopPropagation();
        }
    }

    function close() {
        offset.value = 0;
        open.value = false;
        clearSettle();
        settleTimer = setTimeout(() => {
            settleTimer = null;
            if (!open.value && !dragging.value) {
                key.value = null;
            }
        }, SETTLE_MS);
    }

    function reset() {
        clearSettle();
        gesture = null;
        key.value = null;
        offset.value = 0;
        dragging.value = false;
        open.value = false;
    }

    function clearSettle() {
        if (settleTimer !== null) {
            clearTimeout(settleTimer);
            settleTimer = null;
        }
    }
}

/** How wide the row's actions are: how far it slides; 0 before they are drawn, or with none. */
function measure(row: HTMLElement) {
    return row.querySelector<HTMLElement>('[data-row-swipe-actions]')?.offsetWidth ?? 0;
}
