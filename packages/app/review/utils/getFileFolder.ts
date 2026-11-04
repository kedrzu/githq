/**
 * The folder part of a path, `null` at the root.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getFileFolder(path: string): string | null {
    const slash = path.lastIndexOf('/');
    return slash === -1 ? null : path.slice(0, slash);
}
