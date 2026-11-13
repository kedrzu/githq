/** How long a held arrow moves the cursor one stop a repeat before speeding up (D44). */
const CURSOR_SPEEDUP_DELAY = 400;
/** How often a held arrow then moves the cursor a stop more a repeat. */
const CURSOR_SPEEDUP_INTERVAL = 250;
/** The most stops a single repeat moves the cursor. */
const CURSOR_MAX_STEP = 6;

/**
 * How many stops a key repeat moves the cursor, the key held so long (D44): one for the first 400 ms, so a single press
 * moves exactly one; two from then, and one more every 250 ms after that, up to six.
 *
 * @param heldMs Since the key went down, `0` for the press itself.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getCursorStep(heldMs: number): number {
    if (heldMs < CURSOR_SPEEDUP_DELAY) {
        return 1;
    }

    const speedups = Math.floor((heldMs - CURSOR_SPEEDUP_DELAY) / CURSOR_SPEEDUP_INTERVAL) + 1;
    return Math.min(1 + speedups, CURSOR_MAX_STEP);
}
