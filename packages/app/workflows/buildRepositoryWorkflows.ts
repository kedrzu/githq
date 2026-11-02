import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { getBrokenGroupRef } from './utils/getBrokenGroupRef.js';
import { getRepositoryWorkflowState, RUN_STRIP_SLOTS } from './utils/getRepositoryWorkflowState.js';
import { getRowRef } from './utils/getRowRef.js';
import { getRunVerdict } from './utils/getRunVerdict.js';
import { getWorkflowPatterns } from './utils/getWorkflowPatterns.js';
import { isPullRequestRun } from './utils/isPullRequestRun.js';
import { isWorkflowAlertsOff } from './utils/isWorkflowAlertsOff.js';
import { sortRunsByCreation } from './utils/sortRunsByCreation.js';
import type {
    RepositoryWorkflows,
    StoredWorkflow,
    WorkflowRefSettings,
    WorkflowRowRef,
    WorkflowRowStanding,
    WorkflowState,
    WorkflowsUnavailable,
} from './WorkflowTypes.js';

/** The groups of a repository's Workflows tab, in the order it shows them (actions W3a). */
export type RepositoryWorkflowGroupKind =
    | 'broken'
    | 'pullRequestsOnly'
    | 'noAlerts'
    | 'passing'
    | 'notKnown'
    | 'disabled';

const GROUP_ORDER: readonly RepositoryWorkflowGroupKind[] = [
    'broken',
    'pullRequestsOnly',
    'noAlerts',
    'passing',
    'notKnown',
    'disabled',
];

/** A workflow in its repository's Workflows tab: one row. */
export interface RepositoryWorkflowEntry {
    /** The workflow's id, unique in the repository. */
    readonly key: string;
    readonly workflow: WorkflowState;
    /** Where the tab places it beyond its state; `null` when its state says it all (broken, disabled). */
    readonly standing: WorkflowRowStanding | null;
    /** The ref or pattern the row names; `null` for none (no run known, or only pull requests'). */
    readonly gitRef: WorkflowRowRef | null;
    /** How many more patterns it is broken on: "+1". */
    readonly moreRefCount: number;
    /** The runs its strip shows, oldest first, at most five. */
    readonly runs: readonly GitHubWorkflowRun[];
}

/** One group of the tab, never empty. */
export interface RepositoryWorkflowGroup {
    readonly kind: RepositoryWorkflowGroupKind;
    readonly rows: readonly RepositoryWorkflowEntry[];
}

/** What the tab's Alerts bar says: which refs raise alerts here (actions D5, `Workflow / Alerts bar`). */
export interface RepositoryWorkflowAlerts {
    /** The default branch raises alerts. */
    readonly defaultBranch: boolean;
    /** Its name as GitHub reports it; `null` before the first read. */
    readonly defaultBranchName: string | null;
    /** The patterns, in the user's order. */
    readonly patterns: readonly string[];
}

/** A repository's Workflows tab (actions W3a–W3e, W13, W14). */
export interface RepositoryWorkflowList {
    /** `unread` while nothing is stored of it, `unavailable` while GitHub shows nothing of it. */
    readonly status: 'read' | 'unavailable' | 'unread';
    /** Why GitHub shows nothing, while `unavailable`. */
    readonly unavailable: WorkflowsUnavailable | null;
    readonly alerts: RepositoryWorkflowAlerts;
    /** Nothing raises alerts here: failures never mark the repository broken (W14). */
    readonly alertsOff: boolean;
    /** The groups with rows, in the tab's order; while `unavailable`, the last known rows. */
    readonly groups: readonly RepositoryWorkflowGroup[];
    /** Some active workflow's runs were never read: what is known is so far. */
    readonly reading: boolean;
    /**
     * The tab's count: its broken workflows; `unknown` (a dash) until every workflow's runs are read, or while GitHub
     * shows nothing; `null` — no count — with no workflows or with alerts off.
     */
    readonly count: number | 'unknown' | null;
}

/** What {@link buildRepositoryWorkflows} lists. */
export interface BuildRepositoryWorkflowsParams {
    /** What is stored of the repository's workflows; `undefined` before the first read. */
    readonly stored: RepositoryWorkflows | undefined;
    /** Which refs raise alerts here. */
    readonly settings: WorkflowRefSettings;
    /** Epoch ms "new" is told against. */
    readonly now: number;
}

/**
 * Every workflow of a repository, one row each, grouped for its Workflows tab (actions D7, W3a): broken ones (the
 * newest break first), those only pull requests ran (which never raise alerts), those failing only on refs without
 * alerts — the latest of their runs with a verdict, not started by a pull request, failed —, passing ones, those with
 * no verdict yet, and disabled ones; in GitHub's order within a group. A workflow GitHub generates is a row like any
 * other (D9). While GitHub shows nothing of the repository, the rows last read stay (W3e).
 * @__NO_SIDE_EFFECTS__
 */
export function buildRepositoryWorkflows(params: BuildRepositoryWorkflowsParams): RepositoryWorkflowList {
    const { stored, settings, now } = params;
    const alertsOff = isWorkflowAlertsOff(settings);
    const alerts: RepositoryWorkflowAlerts = {
        defaultBranch: settings.defaultBranch,
        defaultBranchName: stored?.defaultBranch ?? null,
        patterns: getWorkflowPatterns(settings),
    };
    if (!stored) {
        return { status: 'unread', unavailable: null, alerts, alertsOff, groups: [], reading: true, count: 'unknown' };
    }

    // The last known rows of one GitHub shows nothing of now are worked out as if it still did.
    const state = getRepositoryWorkflowState({ ...stored, unavailable: null }, settings, now);
    const placed = state.workflows.flatMap((workflow, index) => {
        const entry = stored.workflows[index];
        return entry ? [placeWorkflow({ stored, entry, workflow, alertsOff })] : [];
    });
    const groups = GROUP_ORDER.map((kind): RepositoryWorkflowGroup => {
        const rows = placed.filter(row => row.group === kind).map(row => row.entry);
        return { kind, rows: kind === 'broken' ? sortByBreak(rows) : rows };
    }).filter(group => group.rows.length > 0);
    const reading = placed.some(row => row.entry.standing?.kind === 'notKnown' && row.entry.standing.reading);

    return {
        status: stored.unavailable === null ? 'read' : 'unavailable',
        unavailable: stored.unavailable,
        alerts,
        alertsOff,
        groups,
        reading,
        count: getCount(),
    };

    function getCount() {
        if (stored?.unavailable !== null) {
            return 'unknown';
        }

        if (state.workflows.length === 0 || alertsOff) {
            return null;
        }

        return reading ? 'unknown' : state.brokenCount;
    }
}

/** What a workflow's row is worked out from. */
interface PlaceWorkflowParams {
    readonly stored: RepositoryWorkflows;
    readonly entry: StoredWorkflow;
    readonly workflow: WorkflowState;
    readonly alertsOff: boolean;
}

interface PlacedWorkflow {
    readonly group: RepositoryWorkflowGroupKind;
    readonly entry: RepositoryWorkflowEntry;
}

function placeWorkflow({ stored, entry, workflow, alertsOff }: PlaceWorkflowParams): PlacedWorkflow {
    const runs = sortRunsByCreation(entry.runs);
    const row = { key: `${workflow.workflow.id}`, workflow, moreRefCount: 0 };

    switch (workflow.state) {
        case 'broken': {
            const [shown, ...others] = workflow.brokenGroups;
            return {
                group: 'broken',
                entry: {
                    ...row,
                    standing: null,
                    gitRef: shown ? getBrokenGroupRef(shown) : null,
                    moreRefCount: others.length,
                    runs: workflow.lastRuns,
                },
            };
        }
        case 'disabled':
            return {
                group: 'disabled',
                entry: {
                    ...row,
                    standing: null,
                    gitRef: getRowRef(stored, runs.at(-1)?.headBranch ?? null),
                    runs: runs.slice(-RUN_STRIP_SLOTS),
                },
            };
        case 'passing':
        case 'unknown':
            break;
        default:
            return assertNever(workflow.state);
    }

    // Never read: no run of it is known, nor that it has none.
    if (runs.length === 0 && Object.keys(entry.etags).length === 0) {
        return {
            group: 'notKnown',
            entry: { ...row, standing: { kind: 'notKnown', reading: true }, gitRef: null, runs: [] },
        };
    }

    const ownRuns = runs.filter(run => !isPullRequestRun(run));
    if (ownRuns.length === 0 && runs.length > 0) {
        const shown = runs.slice(-RUN_STRIP_SLOTS);
        const failedCount = shown.filter(run => getRunVerdict(run) === 'failed').length;
        return {
            group: 'pullRequestsOnly',
            entry: { ...row, standing: { kind: 'pullRequestsOnly', failedCount }, gitRef: null, runs: shown },
        };
    }

    const shown = ownRuns.slice(-RUN_STRIP_SLOTS);
    const latest = ownRuns.findLast(run => getRunVerdict(run) !== null);
    const latestRef = getRowRef(stored, latest?.headBranch ?? null);
    // A failure on a ref with alerts would have broken it: the latest one failing is on a ref without.
    if (latest && latestRef && getRunVerdict(latest) === 'failed') {
        return {
            group: 'noAlerts',
            entry: {
                ...row,
                standing: { kind: 'noAlerts', ref: latestRef, alertsOff },
                gitRef: latestRef,
                runs: shown,
            },
        };
    }

    if (latest) {
        return { group: 'passing', entry: { ...row, standing: { kind: 'passing' }, gitRef: latestRef, runs: shown } };
    }

    return {
        group: 'notKnown',
        entry: {
            ...row,
            standing: { kind: 'notKnown', reading: false },
            gitRef: getRowRef(stored, shown.at(-1)?.headBranch ?? null),
            runs: shown,
        },
    };
}

/** The newest break first; equal ones keep GitHub's order. */
function sortByBreak(rows: readonly RepositoryWorkflowEntry[]) {
    return rows.toSorted((a, b) => (b.workflow.breakStartedAt ?? 0) - (a.workflow.breakStartedAt ?? 0));
}
