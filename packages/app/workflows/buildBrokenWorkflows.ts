import type { TrackedRepositoryWorkflowState } from './WorkflowStore.js';
import type { RepositoryWorkflows, WorkflowRowRef, WorkflowState, WorkflowsUnavailable } from './WorkflowTypes.js';

/** A tracked repository's workflows as the screen reads them: their state, and what was kept of the last read. */
export interface BrokenWorkflowsSource extends TrackedRepositoryWorkflowState {
    /** What was kept of it; `undefined` before the first read. */
    readonly stored: RepositoryWorkflows | undefined;
}

/** A broken workflow on the screen: one row. */
export interface BrokenWorkflowEntry {
    /** Unique on the screen: `owner/name#<workflow id>`. */
    readonly key: string;
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly workflow: WorkflowState;
    /** The ref its latest failed run is on. */
    readonly gitRef: WorkflowRowRef | null;
    /** How many more refs it is broken on: none while only the default branch counts. */
    readonly moreRefCount: number;
}

/** A tracked repository GitHub shows no workflow state of: under "Can't tell", out of the total. */
export interface UnavailableWorkflowsEntry {
    readonly nameWithOwner: string;
    readonly unavailable: WorkflowsUnavailable;
    /** When GitHub last said so (epoch ms). */
    readonly checkedAt: number | null;
}

/** The screen of every broken workflow (actions W2, W2c). */
export interface BrokenWorkflows {
    /** "New": broken less than a day ago, the newest break first. */
    readonly fresh: readonly BrokenWorkflowEntry[];
    /** "Ongoing": broken for longer, the newest break first. */
    readonly ongoing: readonly BrokenWorkflowEntry[];
    /** "Not known yet": the tracked repositories not read yet (`owner/name`), in the user's order. */
    readonly unread: readonly string[];
    /** "Can't tell": the tracked repositories GitHub shows nothing of, in the user's order. */
    readonly unavailable: readonly UnavailableWorkflowsEntry[];
    /** Broken workflows in all tracked repositories, as the sidebar counts them. */
    readonly brokenCount: number;
    /** The repositories with a broken workflow. */
    readonly brokenRepositoryCount: number;
    /** The tracked repositories whose workflows were read and shown. */
    readonly readCount: number;
    /** When the least recently read of {@link readCount} was read (epoch ms); `null` with none. */
    readonly readAt: number | null;
}

/**
 * The broken workflows of every tracked repository, grouped by how new the break is — not by repository, so an old
 * failure cannot hide a fresh one — newest break first in each group; then the repositories not read yet, which
 * nothing claims healthy, and those GitHub shows nothing of, which never add to the total. A repository with no
 * workflows, or none broken, is not listed.
 * @__NO_SIDE_EFFECTS__
 */
export function buildBrokenWorkflows(repositories: readonly BrokenWorkflowsSource[]): BrokenWorkflows {
    const broken: BrokenWorkflowEntry[] = [];
    const unread: string[] = [];
    const unavailable: UnavailableWorkflowsEntry[] = [];
    let brokenCount = 0;
    let brokenRepositoryCount = 0;
    let readCount = 0;
    let readAt: number | null = null;

    for (const { nameWithOwner, state, stored } of repositories) {
        if (state.status === 'unread') {
            unread.push(nameWithOwner);
            continue;
        }

        if (state.status === 'unavailable') {
            if (stored?.unavailable) {
                unavailable.push({ nameWithOwner, unavailable: stored.unavailable, checkedAt: stored.readAt });
            }

            continue;
        }

        readCount += 1;
        if (stored?.readAt != null) {
            readAt = Math.min(readAt ?? stored.readAt, stored.readAt);
        }

        brokenCount += state.brokenCount;
        if (state.brokenCount > 0) {
            brokenRepositoryCount += 1;
        }

        for (const workflow of state.workflows) {
            if (workflow.state !== 'broken') {
                continue;
            }

            const branch = workflow.latestFailedRun?.headBranch ?? stored?.defaultBranch ?? null;
            broken.push({
                key: `${nameWithOwner}#${workflow.workflow.id}`,
                nameWithOwner,
                workflow,
                gitRef: branch === null ? null : { name: branch, kind: 'branch' },
                moreRefCount: 0,
            });
        }
    }

    // Stable: equal breaks keep the user's order of repositories and GitHub's of workflows.
    const sorted = broken.toSorted((a, b) => (b.workflow.breakStartedAt ?? 0) - (a.workflow.breakStartedAt ?? 0));
    return {
        fresh: sorted.filter(entry => entry.workflow.isNew),
        ongoing: sorted.filter(entry => !entry.workflow.isNew),
        unread,
        unavailable,
        brokenCount,
        brokenRepositoryCount,
        readCount,
        readAt,
    };
}
