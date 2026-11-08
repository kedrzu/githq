import { formatAge } from './formatAge.js';
import { formatDuration } from './formatDuration.js';

const MINUTE = 60_000;

/**
 * How long ago something was last checked — `12s` under a minute, as the polls go every minute, then as a row's
 * age (`formatAge`): `3m`, `2h`. A moment in the future reads `0s`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatCheckedAge(at: number, now: number) {
    const elapsed = Math.max(0, now - at);
    return elapsed < MINUTE ? formatDuration(elapsed, { units: 1 }) : formatAge(at, now);
}
