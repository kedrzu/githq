import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const TIME_FORMAT = new Intl.DateTimeFormat(APP_LANGUAGE, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/**
 * A moment of today as the status bar names it — `14:06`, in local time.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatTime(epochMs: number) {
    return TIME_FORMAT.format(epochMs);
}
