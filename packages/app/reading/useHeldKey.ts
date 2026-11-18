import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';

import { Clock } from '@/services/Clock.js';

import { getHeldStep } from './getHeldStep.js';

/** What {@link useHeldKey} gives. */
export interface HeldKey {
    /** One repeat of ↓ (`1`) or ↑ (`-1`) was run: how many stops it moves, more the longer the key is held. */
    step(direction: 1 | -1): number;
}

/** A run of the arrow later than this after the previous one is a new press, not its key's repeat. */
const HOLD_GAP_MS = 150;

/**
 * Tracks an arrow held down for the cursors moving by ↓ ↑ (D44): the only place that does, so the code review's and the
 * reading cursor speed up alike. Commands are told nothing of the key: its release, or the window losing it (⌘Tab), ends
 * the hold.
 */
export function useHeldKey(): HeldKey {
    const clock = useService(Clock);

    /** Since when the arrow has been held, `null` with none. */
    let heldSince: number | null = null;
    let heldDirection: 1 | -1 = 1;
    let lastRun = 0;

    onWindowEvent('keyup', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            heldSince = null;
        }
    });
    onWindowEvent('blur', () => {
        heldSince = null;
    });

    return { step };

    function step(direction: 1 | -1) {
        const now = clock.now();
        if (heldSince === null || direction !== heldDirection || now - lastRun > HOLD_GAP_MS) {
            heldSince = now;
            heldDirection = direction;
        }

        lastRun = now;
        return getHeldStep(now - heldSince);
    }
}
