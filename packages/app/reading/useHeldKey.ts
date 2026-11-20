import { createEventEmitter } from '@nzyme/utils/createEventEmitter.js';
import type { EventEmitter } from '@nzyme/utils/createEventEmitter.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';

import { Clock } from '@/services/Clock.js';

import { getHeldStep } from './getHeldStep.js';

/** What {@link useHeldKey} gives. */
export interface HeldKey {
    /** One repeat of ↓ (`1`) or ↑ (`-1`) was run: how many stops it moves, more the longer the key is held. */
    step(direction: 1 | -1): number;
    /**
     * One run of ↓ (`1`) or ↑ (`-1`): whether it is the key's own repeat, the arrow held down, rather than a press — no
     * release of it since the previous run that way, and that run less than {@link REPEAT_GAP_MS} ago.
     */
    isRepeat(direction: 1 | -1): boolean;
    /** Fires as an arrow is released, or the window loses the keys (⌘Tab): a hold, if any, has ended. */
    readonly released: EventEmitter<[]>;
}

/**
 * How long after a run of the arrow the next one may still be its repeat: past an OS's delay before the first repeat,
 * so the press's second run counts; short enough that a lost keyup ends a hold soon after the repeats stop.
 */
export const REPEAT_GAP_MS = 600;

/** A run of the arrow later than this after the previous one is a new press, not its key's repeat, for `step`. */
const HOLD_GAP_MS = 150;

/**
 * Tracks an arrow held down for the cursors moving by ↓ ↑ (D44): the only place that does, so the code review's and the
 * reading cursor speed up alike. Commands are told nothing of the key: its release, or the window losing it (⌘Tab), ends
 * the hold.
 */
export function useHeldKey(): HeldKey {
    const clock = useService(Clock);
    const { event: released, emit: emitReleased } = createEventEmitter();

    /** Since when the arrow has been held, `null` with none. */
    let heldSince: number | null = null;
    let heldDirection: 1 | -1 = 1;
    let lastRun = 0;
    /** The last run `isRepeat` was asked about, and whether its arrow was released since. */
    let previous: { direction: 1 | -1; at: number; released: boolean } | null = null;

    onWindowEvent('keyup', event => {
        const direction = getArrowDirection(event.key);
        if (direction === null) {
            return;
        }

        heldSince = null;
        if (previous?.direction === direction) {
            previous = { ...previous, released: true };
        }

        emitReleased();
    });
    onWindowEvent('blur', () => {
        heldSince = null;
        previous = null;
        emitReleased();
    });

    return { step, isRepeat, released };

    function step(direction: 1 | -1) {
        const now = clock.now();
        if (heldSince === null || direction !== heldDirection || now - lastRun > HOLD_GAP_MS) {
            heldSince = now;
            heldDirection = direction;
        }

        lastRun = now;
        return getHeldStep(now - heldSince);
    }

    function isRepeat(direction: 1 | -1) {
        const now = clock.now();
        const repeat =
            previous !== null &&
            previous.direction === direction &&
            !previous.released &&
            now - previous.at < REPEAT_GAP_MS;
        previous = { direction, at: now, released: false };
        return repeat;
    }
}

function getArrowDirection(key: string): 1 | -1 | null {
    switch (key) {
        case 'ArrowDown':
            return 1;
        case 'ArrowUp':
            return -1;
        default:
            return null;
    }
}
