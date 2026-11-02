import type {
    RepositoryWorkflowState,
    RepositoryWorkflows,
    StoredWorkflow,
    WorkflowRefSettings,
    WorkflowState,
} from '../WorkflowTypes.js';
import { getRunVerdict } from './getRunVerdict.js';
import { getWorkflowVerdict } from './getWorkflowVerdict.js';
import { isRunCounted } from './isRunCounted.js';
import type { IsRunCountedParams } from './isRunCounted.js';
import { sortRunsByCreation } from './sortRunsByCreation.js';

/** How long a break shows as new: the sidebar marker is bright, and the list puts it under New. */
const NEW_BREAK_MS = 24 * 60 * 60 * 1000;
/** How many runs a workflow's strip shows. */
const STRIP_RUNS = 5;

/**
 * Works out how a repository's workflows stand from what is stored (actions D1, D2): every workflow's state on the
 * refs that count, and the total, the marker and the newest break for the sidebar. A workflow GitHub does not list
 * as active never counts; the stored runs are filtered by `refs` again, so a changed pattern applies at once.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositoryWorkflowState(
    stored: RepositoryWorkflows,
    refs: WorkflowRefSettings,
    now: number,
): RepositoryWorkflowState {
    if (stored.unavailable !== null || stored.readAt === null) {
        return {
            status: stored.unavailable === null ? 'unread' : 'unavailable',
            workflows: [],
            brokenCount: 0,
            newestBreakAt: null,
            hasNewBreak: false,
        };
    }

    const counted: IsRunCountedParams = { ...refs, defaultBranch: stored.defaultBranch };
    const workflows = stored.workflows.map(entry => getWorkflowState(entry, counted, now));
    let brokenCount = 0;
    let newestBreakAt: number | null = null;
    let hasNewBreak = false;
    for (const workflow of workflows) {
        if (workflow.breakStartedAt === null) {
            continue;
        }

        brokenCount += 1;
        newestBreakAt = Math.max(newestBreakAt ?? workflow.breakStartedAt, workflow.breakStartedAt);
        hasNewBreak ||= workflow.isNew;
    }

    return { status: 'read', workflows, brokenCount, newestBreakAt, hasNewBreak };
}

function getWorkflowState(entry: StoredWorkflow, counted: IsRunCountedParams, now: number): WorkflowState {
    const { workflow } = entry;
    const runs = sortRunsByCreation(entry.runs.filter(run => isRunCounted(run, counted)));
    const running = runs.findLast(run => run.status !== 'completed') ?? null;
    const base = {
        workflow,
        generated: workflow.path.startsWith('dynamic/'),
        lastRuns: runs.slice(-STRIP_RUNS),
        runningRun: running,
    };

    if (workflow.state !== 'active') {
        return {
            ...base,
            state: 'disabled',
            breakStartedAt: null,
            breakStartKnown: false,
            isNew: false,
            latestFailedRun: null,
        };
    }

    const verdict = getWorkflowVerdict(runs);
    if (verdict !== 'failed') {
        return {
            ...base,
            state: verdict === 'passed' ? 'passing' : 'unknown',
            breakStartedAt: null,
            breakStartKnown: false,
            isNew: false,
            latestFailedRun: null,
        };
    }

    // The runs after the last passed one, all of them when none passed: the break is what failed among them.
    const lastPass = runs.findLastIndex(run => getRunVerdict(run) === 'passed');
    const breakRuns = runs.slice(lastPass + 1);
    const firstFailure = breakRuns.find(run => getRunVerdict(run) === 'failed');
    const latestFailure = breakRuns.findLast(run => getRunVerdict(run) === 'failed');
    const breakStartedAt = firstFailure ? Date.parse(firstFailure.createdAt) : null;
    return {
        ...base,
        state: 'broken',
        breakStartedAt,
        breakStartKnown: lastPass >= 0,
        isNew: breakStartedAt !== null && now - breakStartedAt < NEW_BREAK_MS,
        latestFailedRun: latestFailure ?? null,
    };
}
