/**
 * Where a list's selection goes when the list changes under it (a sync reorders, adds or removes rows): it stays
 * on the same id while that id is still there; when it is gone, it moves to its nearest neighbour that is still
 * there — the next one in the old order first, then the previous one — never back to the top. `null` stays
 * `null`, and so does an id the old order did not have.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function followSelection(
    previous: readonly string[],
    next: readonly string[],
    selected: string | null,
): string | null {
    if (selected === null || next.includes(selected)) {
        return selected;
    }

    const index = previous.indexOf(selected);
    if (index === -1) {
        return null;
    }

    const remaining = new Set(next);
    for (let after = index + 1; after < previous.length; after++) {
        const id = previous[after];
        if (id !== undefined && remaining.has(id)) {
            return id;
        }
    }

    for (let before = index - 1; before >= 0; before--) {
        const id = previous[before];
        if (id !== undefined && remaining.has(id)) {
            return id;
        }
    }

    return next[Math.min(index, next.length - 1)] ?? null;
}
