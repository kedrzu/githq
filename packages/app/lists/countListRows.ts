import type { ListGroup } from './ListTypes.js';

/**
 * How many entries a list's groups show: each once, however many groups list it (a stack's entry is one, `foldStacks`).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function countListRows<T>(groups: readonly ListGroup<T>[]): number {
    const ids = new Set<string>();
    for (const group of groups) {
        for (const row of group.rows) {
            ids.add(row.id);
        }
    }

    return ids.size;
}
