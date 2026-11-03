import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import type {
    RepositoryWorkflowState,
    RepositoryWorkflows,
    StoredWorkflow,
    WorkflowBreak,
    WorkflowGroupState,
    WorkflowRefGroup,
    WorkflowRefSettings,
    WorkflowState,
} from '../WorkflowTypes.js';
import { getRefGroups } from './getRefGroups.js';
import { getRowRef } from './getRowRef.js';
import { getRunVerdict } from './getRunVerdict.js';
import { getWorkflowVerdict } from './getWorkflowVerdict.js';
import { isRunInGroup } from './isRunInGroup.js';
import { isWorkflowNeverRead } from './isWorkflowNeverRead.js';
import { sortRunsByCreation } from './sortRunsByCreation.js';

/** How long a break shows as new: the sidebar marker is bright, and the list puts it under New. */
const NEW_BREAK_MS = 24 * 60 * 60 * 1000;
/**
 * How many of a workflow's runs one read asks for. Fewer than this in a group means GitHub has no more of them, so
 * the group's whole history is known.
 */
export const WORKFLOW_RUNS_PAGE_SIZE = 10;
/** How many runs a workflow's strip shows. */
export const RUN_STRIP_SLOTS = 5;

const NO_BREAK: WorkflowBreak = { breakStartedAt: null, breakStartKnown: false, isNew: false, latestFailedRun: null };

/**
 * Works out how a repository's workflows stand from what is stored of them — `undefined` while nothing is (actions
 * D1, D2): every workflow's state in each counted group (the default branch, each pattern), and the total and the
 * marker for the sidebar. A workflow is broken when any group is: a pass in one never hides a failure in another. A
 * workflow GitHub does not list as active never counts; the stored runs are grouped by `refs` again, so a changed
 * pattern applies at once.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositoryWorkflowState(
    stored: RepositoryWorkflows | undefined,
    refs: WorkflowRefSettings,
    now: number,
): RepositoryWorkflowState {
    if (!stored || stored.unavailable !== null) {
        return {
            status: stored ? 'unavailable' : 'unread',
            unavailable: stored?.unavailable ?? null,
            reading: false,
            workflows: [],
            brokenCount: 0,
            hasNewBreak: false,
        };
    }

    const groups = getRefGroups(refs, stored.defaultBranch);
    const workflows = stored.workflows.map(entry => getWorkflowState({ stored, entry, groups, now }));
    let brokenCount = 0;
    let hasNewBreak = false;
    for (const workflow of workflows) {
        if (workflow.state !== 'broken') {
            continue;
        }

        brokenCount += 1;
        hasNewBreak ||= workflow.isNew;
    }

    return {
        status: 'read',
        unavailable: null,
        reading: groups.length > 0 && stored.workflows.some(isWorkflowNeverRead),
        workflows,
        brokenCount,
        hasNewBreak,
    };
}

/** What a workflow's state is worked out from. */
interface GetWorkflowStateParams {
    readonly stored: RepositoryWorkflows;
    readonly entry: StoredWorkflow;
    readonly groups: readonly WorkflowRefGroup[];
    readonly now: number;
}

function getWorkflowState({ stored, entry, groups, now }: GetWorkflowStateParams): WorkflowState {
    const { workflow } = entry;
    const runs = sortRunsByCreation(entry.runs);
    // Only the strip's runs: an older one stored in progress may have finished long since, off the page read again.
    const lastRuns = runs.filter(run => groups.some(group => isRunInGroup(run, group))).slice(-RUN_STRIP_SLOTS);
    const base = {
        workflow,
        generated: workflow.path.startsWith('dynamic/'),
        lastRuns,
    };

    if (workflow.state !== 'active') {
        return { ...base, ...NO_BREAK, state: 'disabled', groups: [], brokenGroups: [] };
    }

    const states = groups.map(group => getGroupState({ stored, group, now, runs }));
    const brokenGroups = states
        .filter(group => group.state === 'broken')
        .toSorted((a, b) => (b.breakStartedAt ?? 0) - (a.breakStartedAt ?? 0));
    const shown = brokenGroups[0];
    if (shown) {
        const { breakStartedAt, breakStartKnown, isNew, latestFailedRun } = shown;
        return {
            ...base,
            breakStartedAt,
            breakStartKnown,
            isNew,
            latestFailedRun,
            state: 'broken',
            groups: states,
            brokenGroups,
        };
    }

    return {
        ...base,
        ...NO_BREAK,
        state: states.some(group => group.state === 'passing') ? 'passing' : 'unknown',
        groups: states,
        brokenGroups,
    };
}

/** What a workflow's state in one group is worked out from. */
interface GetGroupStateParams {
    readonly stored: RepositoryWorkflows;
    readonly group: WorkflowRefGroup;
    readonly now: number;
    /** The workflow's runs, oldest first. */
    readonly runs: readonly GitHubWorkflowRun[];
}

function getGroupState({ stored, group, now, runs: all }: GetGroupStateParams): WorkflowGroupState {
    const runs = all.filter(run => isRunInGroup(run, group));
    const verdict = getWorkflowVerdict(runs);
    if (verdict !== 'failed') {
        return { ...NO_BREAK, group, state: verdict === 'passed' ? 'passing' : 'unknown', failedRef: null };
    }

    // The runs after the last passed one, all of them when none passed: the break is what failed among them.
    const lastPass = runs.findLastIndex(run => getRunVerdict(run) === 'passed');
    const breakRuns = runs.slice(lastPass + 1);
    const firstFailure = breakRuns.find(run => getRunVerdict(run) === 'failed');
    const latestFailure = breakRuns.findLast(run => getRunVerdict(run) === 'failed');
    const breakStartedAt = firstFailure ? Date.parse(firstFailure.createdAt) : null;
    // With no pass stored and more runs than one read returns, the break may be far older than the oldest failure kept.
    const breakStartKnown = lastPass >= 0 || runs.length < WORKFLOW_RUNS_PAGE_SIZE;
    return {
        group,
        state: 'broken',
        breakStartedAt,
        breakStartKnown,
        isNew: breakStartKnown && breakStartedAt !== null && now - breakStartedAt < NEW_BREAK_MS,
        latestFailedRun: latestFailure ?? null,
        failedRef: getRowRef(stored, latestFailure?.headBranch ?? null),
    };
}
