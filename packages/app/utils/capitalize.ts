/**
 * The text with its first letter in upper case and the rest as it is — a sentence made of lower-case parts, keeping
 * names such as `GitHub` or a branch's.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
