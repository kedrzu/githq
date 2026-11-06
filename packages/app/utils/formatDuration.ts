import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

/** A unit a duration is said in. */
export type DurationUnit = 'second' | 'minute' | 'hour';

/** How a duration is said, by {@link formatDuration}. */
export interface FormatDurationOptions {
    /** In the largest unit alone (`2m`) or with the next one too (`2m 14s`); 2 by default. */
    readonly units?: 1 | 2;
    /** `2m` (narrow, the default) or `2 min` (short). */
    readonly display?: 'narrow' | 'short';
    /** How the smallest unit shown is reached: `floor` (the default, how long it took), `round` or `ceil`. */
    readonly rounding?: 'floor' | 'round' | 'ceil';
    /** The largest unit it may be said in — "in 75 min" rather than hours; `hour` by default. */
    readonly largestUnit?: DurationUnit;
}

interface Unit {
    readonly unit: DurationUnit;
    readonly ms: number;
    /** The next unit down, said after this one when two are. */
    readonly smaller: Unit | null;
}

const SECOND: Unit = { unit: 'second', ms: 1000, smaller: null };
const MINUTE: Unit = { unit: 'minute', ms: 60_000, smaller: SECOND };
const HOUR: Unit = { unit: 'hour', ms: 3_600_000, smaller: MINUTE };
const UNITS: Readonly<Record<DurationUnit, Unit>> = { second: SECOND, minute: MINUTE, hour: HOUR };

const FORMATS = {
    narrow: createFormats('narrow'),
    short: createFormats('short'),
};

const ROUNDING = {
    floor: Math.floor,
    round: Math.round,
    ceil: Math.ceil,
};

/**
 * How long something took, has been going or is left, as GitHub's checks say it — `45s`, `2m 14s`, `6m 02s` (seconds
 * two digits wide after minutes), `1h 5m` — or in its largest unit alone: `2 min`, `2m`, `1 hr`. The unit is
 * chosen after rounding, so 59.5 s rounded reads `1 min` and 59 min 30 s `1 hr`, never `60 sec` or `60 min`. Below
 * zero reads as zero.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatDuration(ms: number, options: FormatDurationOptions = {}) {
    const { units = 2, display = 'narrow', rounding = 'floor', largestUnit = 'hour' } = options;
    const total = Math.max(0, ms);
    const round = ROUNDING[rounding];
    const formats = FORMATS[display];

    // From the largest unit down, the first the reading one unit down would fill a whole one of, once rounded.
    let unit = UNITS[largestUnit];
    while (unit.smaller) {
        const below = unit.smaller;
        const belowPrecision = getPrecision(below, units);
        if (round(total / belowPrecision.ms) >= unit.ms / belowPrecision.ms) {
            break;
        }

        unit = below;
    }

    const precision = getPrecision(unit, units);
    const count = round(total / precision.ms);
    if (precision === unit) {
        return formats[unit.unit].format(count);
    }

    const ratio = unit.ms / precision.ms;
    const rest = count % ratio;
    const restText = precision === SECOND ? formats.paddedSecond.format(rest) : formats[precision.unit].format(rest);
    return `${formats[unit.unit].format(Math.floor(count / ratio))} ${restText}`;
}

/** The smallest unit shown when `unit` is the largest: itself, or the next one down when two are. */
function getPrecision(unit: Unit, units: 1 | 2) {
    return units === 2 && unit.smaller ? unit.smaller : unit;
}

function createFormats(unitDisplay: 'narrow' | 'short') {
    return {
        hour: new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'hour', unitDisplay }),
        minute: new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'minute', unitDisplay }),
        second: new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'second', unitDisplay }),
        paddedSecond: new Intl.NumberFormat(APP_LANGUAGE, {
            style: 'unit',
            unit: 'second',
            unitDisplay,
            minimumIntegerDigits: 2,
        }),
    };
}
