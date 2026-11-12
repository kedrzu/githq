const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@$/;
const GITLINK_LINE_PATTERN = /^([-+])Subproject commit ([0-9a-f]{40})$/;

/** The commits a submodule pointed at before and after a change. */
export interface SubmodulePointers {
    /** `null` when the change adds the submodule. */
    readonly before: string | null;
    /** `null` when the change removes the submodule. */
    readonly after: string | null;
}

/**
 * Reads a submodule pointer change (a gitlink) from a patch as GitHub's `GET …/pulls/{n}/files` gives it:
 * `@@ -1 +1 @@\n-Subproject commit <old>\n+Subproject commit <new>`, only the `+` line for an added submodule, only
 * the `-` line for a removed one.
 *
 * Returns `null` for a patch that is anything more or less than that one hunk.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function parseSubmodulePatch(patch: string): SubmodulePointers | null {
    const lines = patch
        .split('\n')
        .map(line => (line.endsWith('\r') ? line.slice(0, -1) : line))
        // What a trailing newline leaves.
        .filter(line => line !== '');
    const [header, ...changes] = lines;
    if (header === undefined || !HUNK_HEADER_PATTERN.test(header) || changes.length === 0 || changes.length > 2) {
        return null;
    }

    let before: string | null = null;
    let after: string | null = null;
    for (const line of changes) {
        const match = GITLINK_LINE_PATTERN.exec(line);
        if (match === null) {
            return null;
        }

        const [, kind, oid = null] = match;
        if (kind === '-' && before === null && after === null) {
            before = oid;
        } else if (kind === '+' && after === null) {
            after = oid;
        } else {
            return null;
        }
    }

    return { before, after };
}
