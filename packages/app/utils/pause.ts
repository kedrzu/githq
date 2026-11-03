import type { ClockShape } from '@/services/Clock.js';

/**
 * Resolves once `ms` have passed on `clock`.
 *
 * @util
 */
export function pause(clock: ClockShape, ms: number) {
    return new Promise<void>(resolve => {
        clock.schedule(resolve, ms);
    });
}
