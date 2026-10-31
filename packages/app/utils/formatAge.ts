import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import { getElapsedUnit } from './getElapsedUnit.js';

const NOW = new Intl.RelativeTimeFormat(APP_LANGUAGE, { numeric: 'auto', style: 'narrow' }).format(0, 'second');
const UNITS = ['year', 'week', 'day', 'hour', 'minute'] as const;
const FORMATS: Readonly<Record<(typeof UNITS)[number], Intl.NumberFormat>> = {
    year: narrowUnit('year'),
    week: narrowUnit('week'),
    day: narrowUnit('day'),
    hour: narrowUnit('hour'),
    minute: narrowUnit('minute'),
};

/**
 * How long ago something happened, as a list row says it — `now`, `12m`, `3h`, `2d`, `1w`, `2y` (weeks go on
 * up to a year: a narrow "month" reads as minutes in some browsers). A moment in the future reads `now`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatAge(at: number, now: number) {
    const elapsed = getElapsedUnit(now - at, UNITS);
    return elapsed ? FORMATS[elapsed.unit].format(elapsed.count) : NOW;
}

function narrowUnit(unit: string) {
    return new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit, unitDisplay: 'narrow' });
}
