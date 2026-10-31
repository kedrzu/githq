/**
 * Parses JSON from outside the program — an HTTP body, a stored value — that may be missing or malformed:
 * `undefined` instead of a throw, so the caller validates one `unknown` whatever went wrong.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function parseJson(text: string | null | undefined): unknown {
    if (text == null) {
        return undefined;
    }

    try {
        const value: unknown = JSON.parse(text);
        return value;
    } catch {
        return undefined;
    }
}
