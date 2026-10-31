import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const SHORT_DATE = new Intl.DateTimeFormat(APP_LANGUAGE, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * A calendar day GitHub gives without a time — a milestone's due date, an iteration's start — said short: `Oct 30`.
 * Read in UTC, where GitHub puts such a day, so it is the same day everywhere.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatShortDate(epochMs: number) {
    return SHORT_DATE.format(epochMs);
}
