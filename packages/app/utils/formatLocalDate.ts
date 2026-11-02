import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const LOCAL_DATE = new Intl.DateTimeFormat(APP_LANGUAGE, { month: 'short', day: 'numeric' });

/**
 * The day of a moment, in local time, said short: `Oct 28` — when a run failed, older than "14m ago" says well. A
 * calendar day GitHub gives without a time (a due date) is `formatShortDate`, read in UTC.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatLocalDate(epochMs: number) {
    return LOCAL_DATE.format(epochMs);
}
