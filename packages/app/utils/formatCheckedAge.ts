import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import { formatAge } from './formatAge.js';

const MINUTE = 60_000;
const SECONDS = new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'second', unitDisplay: 'narrow' });

/**
 * How long ago something was last checked — `12s` under a minute, as the polls go every minute, then as a row's
 * age (`formatAge`): `3m`, `2h`. A moment in the future reads `0s`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatCheckedAge(at: number, now: number) {
    const elapsed = Math.max(0, now - at);
    return elapsed < MINUTE ? SECONDS.format(Math.floor(elapsed / 1000)) : formatAge(at, now);
}
