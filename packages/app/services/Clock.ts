import { defineInterface } from '@nzyme/ioc/Interface.js';

/** Time and timers, behind an interface so the sync loops run under `bun test` without waiting for real time. */
export interface ClockShape {
    /** Epoch ms. */
    now(): number;
    /** Calls `callback` once after `delayMs`; the function returned cancels it. */
    schedule(callback: () => void, delayMs: number): () => void;
}

/** The real clock unless a test sets another. */
export const Clock = defineInterface<ClockShape>({
    name: 'Clock',
    default: () => ({
        now: () => Date.now(),
        schedule: (callback, delayMs) => {
            const timer = setTimeout(callback, delayMs);
            return () => clearTimeout(timer);
        },
    }),
});
