import type { CompiledProjectFilter } from './filter/compileProjectFilter.js';
import type { ProjectEntry } from './ProjectTypes.js';

/** What {@link selectProjectEntries} selects from. */
export interface SelectProjectEntriesParams {
    /** The project's entries, archived ones included. */
    readonly entries: readonly ProjectEntry[];
    readonly filter: CompiledProjectFilter;
    /**
     * For a filter left to GitHub (K6): the project item ids GitHub answered it with; `null` until it has. Those
     * the user is adding (a draft on its way) are shown with them.
     */
    readonly answered: ReadonlySet<string> | null;
}

/**
 * The entries a saved view shows: never archived ones (D13); those its filter matches, evaluated here, or — for
 * a filter githq can't evaluate — those GitHub answered it with. `null` while GitHub has not answered yet: the
 * view then waits, and never shows the unfiltered items as if they were the view's.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function selectProjectEntries(params: SelectProjectEntriesParams): ProjectEntry[] | null {
    const { entries, filter, answered } = params;
    const shown = entries.filter(entry => !entry.item.isArchived);
    if (filter.kind === 'local') {
        return shown.filter(entry => filter.matches(entry));
    }

    if (!answered) {
        return null;
    }

    return shown.filter(entry => answered.has(entry.item.itemId) || entry.item.itemId.startsWith('pending:'));
}
