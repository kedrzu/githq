import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import type { WorkflowRunFilters } from '../WorkflowRunHistory.js';
import type { WorkflowRefGroup } from '../WorkflowTypes.js';

/** What each of a workflow's run filters offers, in the order to show. */
export interface WorkflowRunFilterChoices {
    /** The refs that count and can be named exactly, then the refs of the loaded runs. */
    readonly refs: readonly string[];
    readonly events: readonly string[];
    /** A run's conclusion, or its status while it has none: GitHub filters on either. */
    readonly statuses: readonly string[];
    /** Logins. */
    readonly actors: readonly string[];
}

/** What {@link getWorkflowRunFilterChoices} offers from. */
export interface GetWorkflowRunFilterChoicesParams {
    /** The loaded runs, the newest first. */
    readonly runs: readonly GitHubWorkflowRun[];
    /** The repository's counted groups, in their order (`getRefGroups`). */
    readonly refGroups: readonly WorkflowRefGroup[];
    /** The filters set: a value chosen stays offered when no loaded run has it. */
    readonly filters: WorkflowRunFilters;
}

/** A character that makes a pattern match more than one ref (actions D13): GitHub filters runs only by an exact ref. */
const WILDCARD = /[*?+[\\]/;

/**
 * The values a workflow's run filters offer (exact values, as GitHub filters on them): those of the loaded runs, the
 * newest run's first, after the refs that count — the default branch, a pattern naming one ref — and the values set.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getWorkflowRunFilterChoices(params: GetWorkflowRunFilterChoicesParams): WorkflowRunFilterChoices {
    const { runs, refGroups, filters } = params;
    const counted = refGroups.flatMap(group => {
        if (group.kind === 'defaultBranch') {
            return [group.branch];
        }

        return WILDCARD.test(group.pattern) ? [] : [group.pattern];
    });

    return {
        refs: unique([...counted, ...runs.map(run => run.headBranch), filters.ref]),
        events: unique([...runs.map(run => run.event), filters.event]),
        statuses: unique([...runs.map(run => run.conclusion ?? run.status), filters.status]),
        actors: unique([...runs.map(run => run.actor?.login ?? null), filters.actor]),
    };
}

function unique(values: readonly (string | null)[]) {
    return [...new Set(values.filter(value => value !== null))];
}
