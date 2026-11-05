import { canScrollHorizontally } from '@nzyme/dom-utils/canScrollHorizontally.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, onScopeDispose, ref } from 'vue';
import { useRouter } from 'vue-router';

/** Which way a swipe goes through the window's history. */
export type HistorySwipeDirection = 'back' | 'forward';

/** How far (px of scrolling) the fingers travel before the swipe knows which way they go. */
const DECIDE_DISTANCE = 6;
/** How far a swipe has to go to go back or forward. */
const COMMIT_DISTANCE = 120;
/** How far a quick flick has to go: as `useSwipeHorizontal` (`@nzyme/vue-utils`) tells a swipe from a pan. */
const FLICK_DISTANCE = 40;
/** How quick a flick is (ms). */
const FLICK_TIME = 250;
/**
 * How long (ms) with no scrolling ends a swipe: a wheel event does not say the fingers left the trackpad. The scrolling
 * that coasts on after them counts as the same swipe, so it cannot start another one on the page it went to.
 */
const QUIET_TIME = 120;

/**
 * A two-finger swipe across a trackpad going back (fingers to the right) or forward: the browser's gesture, which the
 * desktop app's window does not have. It tracks the horizontal scrolling the swipe makes, as long as nothing under
 * the pointer would scroll that way, and goes when the fingers stop after going far enough. Nothing starts with no
 * entry to go to.
 */
export function useHistorySwipe() {
    const router = useRouter();

    /** What the current swipe does: `undefined` before it knows, `null` when it is left to scrolling. */
    const direction = ref<HistorySwipeDirection | null>();
    const distance = ref(0);
    let pending = { x: 0, y: 0 };
    let startedAt = 0;
    let quietTimer: ReturnType<typeof setTimeout> | undefined;

    onWindowEvent('wheel', onWheel, { passive: true });
    onScopeDispose(() => clearTimeout(quietTimer));

    return reactive({
        /** Which way the swipe in progress goes, if it is one. */
        direction: computed(() => direction.value ?? undefined),
        /** How far it has gone towards going there: 1 is far enough. */
        progress: computed(() => (direction.value ? Math.min(distance.value / COMMIT_DISTANCE, 1) : 0)),
    });

    function onWheel(event: WheelEvent) {
        // A pinch: the zoom, not a swipe.
        if (event.ctrlKey) {
            return;
        }

        clearTimeout(quietTimer);
        quietTimer = setTimeout(end, QUIET_TIME);

        if (direction.value === undefined) {
            decide(event);
        } else if (direction.value) {
            // Natural scrolling: fingers to the right scroll left, a negative delta.
            distance.value = Math.max(0, distance.value + (direction.value === 'back' ? -event.deltaX : event.deltaX));
        }
    }

    function decide(event: WheelEvent) {
        if (pending.x === 0 && pending.y === 0) {
            startedAt = event.timeStamp;
        }

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

    function end() {
        const flick = distance.value >= FLICK_DISTANCE && performance.now() - startedAt - QUIET_TIME < FLICK_TIME;
        if (direction.value && (distance.value >= COMMIT_DISTANCE || flick)) {
            if (direction.value === 'back') {
                router.back();
            } else {
                router.forward();
            }
        }

        direction.value = undefined;
        distance.value = 0;
        pending = { x: 0, y: 0 };
    }
}
