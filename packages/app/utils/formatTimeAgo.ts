import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import { getElapsedUnit } from './getElapsedUnit.js';

const RELATIVE = new Intl.RelativeTimeFormat(APP_LANGUAGE, { numeric: 'auto' });
const UNITS = ['year', 'month', 'day', 'hour', 'minute'] as const;

/**
 * How long ago something happened, in words — `3 days ago`, `yesterday`, `now` — where a sentence has room for
 * it ("opened 3 days ago"); a row says it shorter (`formatAge`). A moment in the future reads `now`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatTimeAgo(at: number, now: number) {
    const elapsed = getElapsedUnit(now - at, UNITS);
    return elapsed ? RELATIVE.format(-elapsed.count, elapsed.unit) : RELATIVE.format(0, 'second');
}
