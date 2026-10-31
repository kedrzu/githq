import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const UNIT = {
    hour: new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'hour', unitDisplay: 'narrow' }),
    minute: new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'minute', unitDisplay: 'narrow' }),
    second: new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'second', unitDisplay: 'narrow' }),
};

/**
 * How long something took or has been going, as a check says it — `45s`, `2m 14s`, `1h 5m`: the largest unit and
 * the next one (seconds two digits wide after minutes, `6m 02s`, as GitHub writes them).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatDuration(ms: number) {
    const total = Math.max(0, ms);
    if (total >= HOUR) {
        return `${UNIT.hour.format(Math.floor(total / HOUR))} ${UNIT.minute.format(Math.floor((total % HOUR) / MINUTE))}`;
    }

    if (total >= MINUTE) {
        const seconds = Math.floor((total % MINUTE) / SECOND);
        return `${UNIT.minute.format(Math.floor(total / MINUTE))} ${UNIT.second.format(seconds).padStart(3, '0')}`;
    }

    return UNIT.second.format(Math.floor(total / SECOND));
}
