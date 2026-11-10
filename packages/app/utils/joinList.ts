import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const LIST = new Intl.ListFormat(APP_LANGUAGE);

/**
 * Things in a sentence as the app lists them (`formatList`), each kept as it is — an element too: `a, b, and c` as
 * `[a, ', ', b, ', and ', c]`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function joinList<T>(items: readonly T[]): (T | string)[] {
    const joined: (T | string)[] = [];
    for (const part of LIST.formatToParts(items.map((_, index) => String(index)))) {
        const item = part.type === 'element' ? items[Number(part.value)] : undefined;
        if (part.type === 'literal') {
            joined.push(part.value);
        } else if (item !== undefined) {
            joined.push(item);
        }
    }

    return joined;
}
