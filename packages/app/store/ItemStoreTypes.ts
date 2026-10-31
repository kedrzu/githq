/** Why an item is in the user's work: the "my work" search that found it (D11). */
export type MyWorkGroup = 'reviewRequested' | 'authored' | 'assigned' | 'mentioned';

/** The groups of "my work", in the order the list shows them. */
export const MY_WORK_GROUPS: readonly MyWorkGroup[] = ['reviewRequested', 'authored', 'assigned', 'mentioned'];

/**
 * The item ids of each "my work" group. A group is missing until its search first answers — on the first
 * download the groups arrive one by one.
 */
export type MyWorkMembership = Readonly<Partial<Record<MyWorkGroup, ReadonlySet<string>>>>;

/**
 * A sync loop: the "my work" searches, the re-read of open pull requests' status, the polls of tracked
 * repositories and projects, and their first download.
 */
export type SyncLoop = 'myWork' | 'pullRequestStatuses' | 'repositories' | 'projects' | 'download';

/** Every sync loop. */
export const SYNC_LOOPS: readonly SyncLoop[] = [
    'myWork',
    'pullRequestStatuses',
    'repositories',
    'projects',
    'download',
];

/** How a sync loop last went — what the freshness of a screen is told from (D15). Times are epoch ms. */
export interface SyncLoopState {
    readonly lastAttemptAt: number | null;
    readonly lastSuccessAt: number | null;
    /** Why the last attempt failed; `null` after a success. */
    readonly lastError: string | null;
    /**
     * The last success did not see everything: a "my work" search matched more than its one page holds (100)
     * or GitHub said its results are incomplete. Rare; the newest changes are in, older ones may be missing.
     */
    readonly incomplete: boolean;
}
