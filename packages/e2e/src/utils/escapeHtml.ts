/**
 * The text as HTML text or an attribute value: `&`, `<`, `>`, `"` and `'` as their entities — how GitHub
 * renders what a user typed into the `bodyHTML` the mock answers with.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function escapeHtml(text: string) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
