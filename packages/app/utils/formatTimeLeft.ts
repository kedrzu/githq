import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 3600;

const UNITS = {
    short: createUnits('short'),
    narrow: createUnits('narrow'),
};

/**
 * Roughly how long is left, in its largest unit: "45 sec", "2 min", "1 hr" — "45s", "2m", "1h" narrow.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatTimeLeft(seconds: number, display: 'narrow' | 'short') {
    const units = UNITS[display];
    if (seconds < SECONDS_IN_MINUTE) {
        return units.second.format(seconds);
    }

    if (seconds < SECONDS_IN_HOUR) {
        return units.minute.format(Math.round(seconds / SECONDS_IN_MINUTE));
    }

    return units.hour.format(Math.round(seconds / SECONDS_IN_HOUR));
}

function createUnits(unitDisplay: 'narrow' | 'short') {
    return {
        hour: new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'hour', unitDisplay }),
        minute: new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'minute', unitDisplay }),
        second: new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'second', unitDisplay }),
    };
}
