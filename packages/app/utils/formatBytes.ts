import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const MEGABYTES = new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 });
const KILOBYTES = new Intl.NumberFormat(APP_LANGUAGE, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 });

/**
 * How much something takes, as the app says it: `48 MB`, under a megabyte `320 kB`.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatBytes(bytes: number) {
    return bytes >= 1_000_000 ? MEGABYTES.format(bytes / 1_000_000) : KILOBYTES.format(bytes / 1000);
}
