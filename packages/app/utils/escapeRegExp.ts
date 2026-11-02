/**
 * The text as a regular expression source matching it literally: `acme/web.js` → `acme/web\.js`. Only the syntax
 * characters are escaped, so the result is valid with the `u` and `v` flags too — but outside a character class.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function escapeRegExp(text: string) {
    return text.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&');
}
