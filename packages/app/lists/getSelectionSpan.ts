import type { ListGroup, ListRow } from './ListTypes.js';

/** What the items edited together span in a list (D20, SP28): "9 pull requests selected, in 3 entries and 1 row". */
export interface SelectionSpan {
    /** Stacks' entries with any of their pull requests selected, a half-marked one too. */
    readonly entries: number;
    /** Selected items outside any stack's entry, each once. */
    readonly rows: number;
}

/**
 * How many stacks' entries and rows the items edited together (`ids`) span among the list's `groups` — the stacks' entries
 * nested under a row (my work's, D12) included.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getSelectionSpan<T>(groups: readonly ListGroup<T>[], ids: readonly string[]): SelectionSpan {
    const selected = new Set(ids);
    const entries = new Set<string>();
    const inEntries = new Set<string>();
    for (const group of groups) {
        for (const row of group.rows) {
            for (const stackRow of [row, ...(row.stacks ?? [])]) {
                if (stackRow.stack) {
                    countEntry(stackRow);
                }
            }
        }
    }

    const rows = [...selected].filter(id => !inEntries.has(id)).length;
    return { entries: entries.size, rows };

    function countEntry(entry: ListRow<T>) {
        const members = entry.nested.map(member => member.id).filter(id => selected.has(id));
        if (members.length === 0) {
            return;
        }

        entries.add(entry.key);
        for (const id of members) {
            inEntries.add(id);
        }
    }
}
