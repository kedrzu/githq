/**
 * The text as a regular expression matching it literally: `acme/web.js` → `acme/web\.js`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
