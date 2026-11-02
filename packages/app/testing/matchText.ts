import { escapeRegExp } from '@/utils/escapeRegExp.js';

/**
 * A pattern matching the whole of `text` with any space where it has one: the translations keep short words with
 * the next one, and some formats put a narrow space between a number and its unit, so a test can't spell them.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function matchText(text: string) {
    return new RegExp(`^${escapeRegExp(text).replaceAll(' ', '\\s')}$`);
}
