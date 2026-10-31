const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A unit an elapsed time is said in. */
export type ElapsedUnit = 'day' | 'hour' | 'minute' | 'month' | 'week' | 'year';

/** How much time has elapsed, in whole units. */
export interface ElapsedTime<TUnit extends ElapsedUnit = ElapsedUnit> {
    readonly unit: TUnit;
    readonly count: number;
}

const UNIT_MS: Readonly<Record<ElapsedUnit, number>> = {
    year: 365 * DAY,
    month: 30 * DAY,
    week: 7 * DAY,
    day: DAY,
    hour: HOUR,
    minute: MINUTE,
};

/**
 * `elapsed` ms in the largest of `units` (given largest first) it holds a whole one of, and how many; `null` under
 * the smallest — and for a moment in the future. What "3 days ago" and "3d" are both said from.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getElapsedUnit<TUnit extends ElapsedUnit>(
    elapsed: number,
    units: readonly TUnit[],
): ElapsedTime<TUnit> | null {
    for (const unit of units) {
        const ms = UNIT_MS[unit];
        if (elapsed >= ms) {
            return { unit, count: Math.floor(elapsed / ms) };
        }
    }

    return null;
}
