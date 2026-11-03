import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';
import { groupByToMap } from '@nzyme/utils/array/groupByToMap.js';

import type { RefKind, RepositoryWorkflows, RunVerdict } from '../WorkflowTypes.js';
import { getRefKind } from './getRefKind.js';
import { getStandingVerdict } from './getStandingVerdict.js';
import { isPullRequestRun } from './isPullRequestRun.js';
import { sortRunsByCreation } from './sortRunsByCreation.js';

/** A ref githq has seen a run on that could count: not one started by a pull request (actions D1). */
export interface KnownRef {
    /** `main`, `v0.1.0-rc.3`. */
    readonly name: string;
    readonly kind: RefKind;
    /** The creation of its latest run stored (epoch ms). */
    readonly latestRunAt: number;
    /** The workflows that ran there, in GitHub's order. */
    readonly workflows: readonly KnownRefWorkflow[];
}

/** A workflow that ran on a {@link KnownRef}. */
export interface KnownRefWorkflow {
    readonly workflow: GitHubWorkflow;
    /** The verdict of its latest run there that has one; `null` while none has. */
    readonly verdict: RunVerdict | null;
    /** The creation of that run (epoch ms); `null` while none has a verdict. */
    readonly verdictAt: number | null;
}

/**
 * The refs githq has seen runs on, from the runs stored — those not started by a pull request, which never count —
 * the latest run first: what a pattern can be shown to match (actions D13). Only refs with a recent run are known, so
 * it never claims a pattern matches nothing at all. Empty before the first read.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getKnownRefs(stored: RepositoryWorkflows | undefined): KnownRef[] {
    if (!stored) {
        return [];
    }

    const refs = new Map<string, { latestRunAt: number; workflows: KnownRefWorkflow[] }>();
    for (const { workflow, runs } of stored.workflows) {
        const byRef = groupByToMap(
            runs.filter(run => run.headBranch !== null && !isPullRequestRun(run)),
            run => run.headBranch ?? '',
        );

        for (const [name, onRef] of byRef) {
            const latestRunAt = Math.max(...onRef.map(run => Date.parse(run.createdAt)));
            const known = refs.get(name) ?? { latestRunAt, workflows: [] };
            known.latestRunAt = Math.max(known.latestRunAt, latestRunAt);
            const decided = sortRunsByCreation(onRef).findLast(run => getStandingVerdict(run) !== null);
            known.workflows.push({
                workflow,
                verdict: decided ? getStandingVerdict(decided) : null,
                verdictAt: decided ? Date.parse(decided.createdAt) : null,
            });
            refs.set(name, known);
        }
    }

    const known: KnownRef[] = [];
    for (const [name, { latestRunAt, workflows }] of refs) {
        known.push({ name, kind: getRefKind(stored, name), latestRunAt, workflows });
    }

    return known.toSorted((a, b) => b.latestRunAt - a.latestRunAt);
}
