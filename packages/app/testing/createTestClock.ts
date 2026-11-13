import type { ClockShape } from '@/services/Clock.js';

import { settle } from './settle.js';

/** A clock that moves only when told. */
export interface TestClock extends ClockShape {
    /** Moves the time on, running the timers that fall due on the way and letting their work settle. */
    advance(ms: number): Promise<void>;
}

/**
 * A clock that starts at `start` (epoch ms) and moves only when told, running the timers that fall due on the way.
 * @util
 */
export function createTestClock(start: number): TestClock {
    let now = start;
    let timers: { at: number; callback: () => void }[] = [];

    return {
        now: () => now,
        schedule: (callback, delayMs) => {
            const timer = { at: now + delayMs, callback };
            timers.push(timer);
            return () => {
                timers = timers.filter(other => other !== timer);
            };
        },
        advance: async ms => {
            const end = now + ms;
            await settle();
            for (;;) {
                const next = timers.toSorted((a, b) => a.at - b.at)[0];
                if (!next || next.at > end) {
                    break;
                }

                timers = timers.filter(other => other !== next);
                now = next.at;
                next.callback();
                await settle();
            }

            now = end;
            await settle();
        },
    };
}
