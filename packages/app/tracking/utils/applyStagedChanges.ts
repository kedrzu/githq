import type { TrackingChoice } from '../TrackingStore.js';
import type { TrackedProject, TrackedRepository } from '../TrackingTypes.js';

/** What the user ticked and unticked of one kind, not saved yet. */
export interface StagedChanges<T> {
    /** To be tracked, in the order given. */
    readonly added: readonly T[];
    /** To be untracked, by what names them: `owner/name` or the project's id. */
    readonly removed: readonly string[];
}

/** Settings' staged ticks (G8, D24): what saving tracks and untracks. */
export interface StagedTrackingChanges {
    readonly repositories: StagedChanges<TrackedRepository>;
    readonly projects: StagedChanges<TrackedProject>;
}

/**
 * What saving Settings' ticks makes tracked: what is tracked now with exactly the staged changes applied — so one
 * tracked meanwhile (another tab, the sidebar) or never shown as a row stays tracked. Those that stay keep their order,
 * new ones come after in the order given, and one already tracked is not added twice.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function applyStagedChanges(current: TrackingChoice, changes: StagedTrackingChanges): TrackingChoice {
    return {
        repositories: applyChanges(current.repositories, changes.repositories, repository => repository.nameWithOwner),
        projects: applyChanges(current.projects, changes.projects, project => project.id),
    };
}

function applyChanges<T>(current: readonly T[], changes: StagedChanges<T>, getKey: (entry: T) => string): T[] {
    const removed = new Set(changes.removed);
    const tracked = new Set(current.map(getKey));
    return [
        ...current.filter(entry => !removed.has(getKey(entry))),
        ...changes.added.filter(entry => !tracked.has(getKey(entry))),
    ];
}
