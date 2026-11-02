/**
 * An ETag hashed from what an answer says, as GitHub's are: the same while nothing it says changes.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function etagOf(value: unknown): string {
    let hash = 5381;
    for (const char of JSON.stringify(value)) {
        hash = (Math.imul(hash, 33) ^ (char.codePointAt(0) ?? 0)) >>> 0;
    }

    return `W/"${hash.toString(16)}"`;
}
