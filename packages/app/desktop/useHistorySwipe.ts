import { canScrollHorizontally } from '@nzyme/dom-utils/canScrollHorizontally.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onScopeDispose, ref } from 'vue';
import { useRouter } from 'vue-router';

import { NativeBridge } from './NativeBridge.js';
import type { ScrollPhase } from './NativeBridge.js';

/** Which way a swipe goes through the window's history. */
export type HistorySwipeDirection = 'back' | 'forward';

/** How far (px of scrolling) the fingers travel before the swipe knows which way they go. */
const DECIDE_DISTANCE = 6;
/** How far a swipe has to go to go back or forward. */
const COMMIT_DISTANCE = 120;
/** How far a quick flick has to go: as `useSwipeHorizontal` (`@nzyme/vue-utils`) tells a swipe from a pan. */
const FLICK_DISTANCE = 40;
/** How quick a flick is (ms), from the fingers coming down to lifting off. */
const FLICK_TIME = 250;

/**
 * A two-finger swipe across a Mac's trackpad going back (fingers to the right) or forward: the browser's gesture, which
 * the desktop app's window does not have. It runs from the fingers coming down to their lifting off, as the native
 * side tells (`NativeBridge.onScrollPhase`), and tracks the horizontal scrolling in between, as long as nothing under
 * the pointer would scroll that way. It goes as the fingers lift after going far enough: resting them does not, and
 * the scrolling that coasts on after them, like a mouse's wheel, starts nothing. Nothing starts with no entry to go to.
 */
export function useHistorySwipe() {
    const router = useRouter();
    const bridge = useService(NativeBridge);

    /** What the current swipe does: `undefined` before it knows, `null` when it is left to scrolling. */
    const direction = ref<HistorySwipeDirection | null>();
    const distance = ref(0);
    let fingersDown = false;
    let disposed = false;
    let pending = { x: 0, y: 0 };
    let startedAt = 0;

    onWindowEvent('wheel', onWheel, { passive: true });
    // The bridge cannot stop listening: a disposed swipe ignores what it is told.
    void bridge.onScrollPhase(onPhase);
    onScopeDispose(() => {
        disposed = true;
    });

    return reactive({
        /** Which way the swipe in progress goes, if it is one. */
        direction: computed(() => direction.value ?? undefined),
        /** How far it has gone towards going there: 1 is far enough. */
        progress: computed(() => (direction.value ? Math.min(distance.value / COMMIT_DISTANCE, 1) : 0)),
    });

    function onPhase(phase: ScrollPhase) {
        if (disposed) {
            return;
        }

        switch (phase) {
            case 'began':
                reset();
                fingersDown = true;
                startedAt = performance.now();
                break;
            case 'ended':
                if (fingersDown) {
                    go();
                }
                reset();
                break;
            case 'cancelled':
                reset();
                break;
        }
    }

    function onWheel(event: WheelEvent) {
        // A pinch zooms; scrolling with no fingers down coasts on, or comes from a mouse.
        if (!fingersDown || event.ctrlKey) {
            return;
        }

        if (direction.value === undefined) {
            decide(event);
        } else if (direction.value) {
            // Natural scrolling: fingers to the right scroll left, a negative delta.
            distance.value = Math.max(0, distance.value + (direction.value === 'back' ? -event.deltaX : event.deltaX));
        }
    }

    function decide(event: WheelEvent) {
        pending = { x: pending.x + event.deltaX, y: pending.y + event.deltaY };
        if (Math.abs(pending.x) < DECIDE_DISTANCE && Math.abs(pending.y) < DECIDE_DISTANCE) {
            return;
        }

        const way: HistorySwipeDirection = pending.x < 0 ? 'back' : 'forward';
        const history = router.options.history.state;
        const blocked =
            Math.abs(pending.y) >= Math.abs(pending.x) ||
            (way === 'back' ? history.back : history.forward) == null ||
            canScrollHorizontally(event.target, way === 'back' ? 'left' : 'right');

        direction.value = blocked ? null : way;
        distance.value = blocked ? 0 : Math.abs(pending.x);
    }

    function go() {
        const flick = distance.value >= FLICK_DISTANCE && performance.now() - startedAt < FLICK_TIME;
        if (!direction.value || (distance.value < COMMIT_DISTANCE && !flick)) {
            return;
        }

        if (direction.value === 'back') {
            router.back();
        } else {
            router.forward();
        }
    }

    function reset() {
        fingersDown = false;
        direction.value = undefined;
        distance.value = 0;
        pending = { x: 0, y: 0 };
    }
}
