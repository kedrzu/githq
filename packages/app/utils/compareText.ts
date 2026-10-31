/**
 * Compares two strings by their code units, not by the locale's collation — for ISO dates, ids and
 * `owner/name`, which must order the same in every browser.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function compareText(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}
