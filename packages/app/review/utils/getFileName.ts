/**
 * The last part of a path.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getFileName(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
}
