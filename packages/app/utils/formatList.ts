import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const LIST = new Intl.ListFormat(APP_LANGUAGE);

/**
 * Names in a sentence, as the app says them: `Release, Deploy, and Lint`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatList(items: Iterable<string>) {
    return LIST.format(items);
}
