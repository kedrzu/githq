import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import type { GitHubWorkflowFileParse } from '@githq/github/workflows/parseWorkflowFile.js';

import { getStandingVerdict } from './utils/getStandingVerdict.js';
import { isRunInGroup } from './utils/isRunInGroup.js';
import { matchRefPattern } from './utils/matchRefPattern.js';
import { mergeRunsById } from './utils/mergeRunsById.js';
import type { WorkflowFileRead } from './WorkflowFileStore.js';
import type {
    RefKind,
    RepositoryWorkflows,
    RunVerdict,
    WorkflowGroupState,
    WorkflowRefGroup,
    WorkflowState,
} from './WorkflowTypes.js';

/** What a workflow's Details column shows (actions W30, W42). */
export interface WorkflowDetails {
    readonly workflow: GitHubWorkflow;
    /** GitHub lists it as active; anything else is disabled. */
    readonly active: boolean;
    /** GitHub generates it itself (Pages, Dependabot, CodeQL): there is no file to read, run by hand or open. */
    readonly generated: boolean;
    /** Its file at the default branch: what starts it, what a dispatch asks for, or why that is not known. */
    readonly file: WorkflowDetailsFile;
    /** How it stands on each ref that counts, in the settings' order; empty while it is disabled. */
    readonly countsOn: readonly WorkflowCountedRef[];
    /** The latest run that succeeded; `null` when none is known. */
    readonly lastSuccess: GitHubWorkflowRun | null;
    /** The median time the last 20 successful runs known took (ms); `null` when none is known. */
    readonly typicalDurationMs: number | null;
    /** The latest run not finished yet; `null` when none is. */
    readonly running: GitHubWorkflowRun | null;
}

/**
 * A workflow's file as the details tell it: its parse, or `generated` (there is none), `loading` (not read yet) or
 * `failed` (the read did not happen).
 */
export type WorkflowDetailsFile =
    | GitHubWorkflowFileParse
    | { readonly kind: 'generated' }
    | { readonly kind: 'loading' }
    | { readonly kind: 'failed' };

/** How a workflow stands on one ref that counts: "main · Since #4816, 3 failed runs in a row". */
export interface WorkflowCountedRef {
    readonly group: WorkflowRefGroup;
    /** As the alerts tell it, from the runs the sync keeps. */
    readonly state: WorkflowGroupState['state'];
    /** Whether its refs are branches or tags: a pattern matching a tag, or one a trigger's `tags` names, is a tag's. */
    readonly refKind: RefKind;
    /** The latest runs with the same verdict, in a row; `null` while no run there has one ("No runs on a tag yet"). */
    readonly streak: WorkflowRunStreak | null;
}

/** The latest runs of a ref group that agree, skipping those with no verdict. */
export interface WorkflowRunStreak {
    readonly verdict: RunVerdict;
    /** The first run of the streak: "Since #4816". */
    readonly since: GitHubWorkflowRun;
    readonly count: number;
}

/** What {@link buildWorkflowDetails} builds from. */
export interface BuildWorkflowDetailsParams {
    /** The repository's workflows, as the sync keeps them. */
    readonly stored: RepositoryWorkflows;
    /** The workflow's state, as the alerts work it out (`getRepositoryWorkflowState`). */
    readonly state: WorkflowState;
    /** What was read of its file at the default branch (`WorkflowFileStore`); not read for a generated workflow. */
    readonly file: WorkflowFileRead;
    /** Its runs read on demand (`WorkflowRunHistory`), the newest first: fresher than the sync's, and more. */
    readonly runs: readonly GitHubWorkflowRun[];
}

/** How many of the latest successful runs the typical run time is the median of. */
const TYPICAL_RUNS = 20;

/**
 * A workflow's details from what the sync keeps of it, how the alerts judge it, its file and the runs read on demand.
 * The runs both know of are told as read on demand.
 * @__NO_SIDE_EFFECTS__
 */
export function buildWorkflowDetails(params: BuildWorkflowDetailsParams): WorkflowDetails {
    const { stored, state, file, runs } = params;
    const { workflow } = state;
    const storedRuns = stored.workflows.find(entry => entry.workflow.id === workflow.id)?.runs ?? [];
    const known = mergeRunsById([storedRuns, runs]);
    const detailsFile = getDetailsFile(state.generated, file);
    const successes = known.filter(run => run.status === 'completed' && run.conclusion === 'success');

    return {
        workflow,
        active: workflow.state === 'active',
        generated: state.generated,
        file: detailsFile,
        countsOn: state.groups.map(group => ({
            group: group.group,
            state: group.state,
            refKind: getGroupRefKind({ group: group.group, tags: stored.tags, file: detailsFile }),
            streak: getStreak(known.filter(run => isRunInGroup(run, group.group))),
        })),
        lastSuccess: successes[0] ?? null,
        typicalDurationMs: getMedian(successes.slice(0, TYPICAL_RUNS).map(getDuration)),
        running: known.find(run => run.status !== 'completed') ?? null,
    };
}

function getDetailsFile(generated: boolean, file: WorkflowFileRead): WorkflowDetailsFile {
    if (generated) {
        return { kind: 'generated' };
    }

    if (file.parse) {
        return file.parse;
    }

    return file.status === 'failed' ? { kind: 'failed' } : { kind: 'loading' };
}

/** What a group's ref kind is told from. */
interface GetGroupRefKindParams {
    readonly group: WorkflowRefGroup;
    readonly tags: readonly string[];
    readonly file: WorkflowDetailsFile;
}

function getGroupRefKind({ group, tags, file }: GetGroupRefKindParams): RefKind {
    if (group.kind === 'defaultBranch') {
        return 'branch';
    }

    const { pattern } = group;
    const triggerTags =
        file.kind === 'parsed' && file.file.triggers.some(trigger => trigger.tags?.includes(pattern) === true);
    return triggerTags || tags.some(tag => matchRefPattern(pattern, tag)) ? 'tag' : 'branch';
}

/** `runs` the newest first. */
function getStreak(runs: readonly GitHubWorkflowRun[]): WorkflowRunStreak | null {
    const decided = runs.filter(run => getStandingVerdict(run) !== null);
    const latest = decided[0];
    if (!latest) {
        return null;
    }

    const verdict = getStandingVerdict(latest);
    const end = decided.findIndex(run => getStandingVerdict(run) !== verdict);
    const streak = end < 0 ? decided : decided.slice(0, end);
    return verdict && { verdict, since: streak.at(-1) ?? latest, count: streak.length };
}

/** How long a finished run took: from when its attempt started running, or was created, to when it finished. */
function getDuration(run: GitHubWorkflowRun) {
    return Date.parse(run.updatedAt) - Date.parse(run.runStartedAt ?? run.createdAt);
}

function getMedian(values: readonly number[]) {
    const sorted = values.toSorted((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const upper = sorted[middle];
    if (upper === undefined) {
        return null;
    }

    const lower = sorted[middle - 1];
    return sorted.length % 2 === 0 && lower !== undefined ? (lower + upper) / 2 : upper;
}
