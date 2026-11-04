/**
 * The bytes as lowercase hexadecimal, two digits each.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function toHex(bytes: Uint8Array) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
