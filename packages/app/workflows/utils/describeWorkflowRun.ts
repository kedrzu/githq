import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

import { getRunVerdict } from './getRunVerdict.js';

/** How a run's line marks it: by its verdict, or as still going, or as one that says nothing (cancelled, skipped). */
export type WorkflowRunMark = 'failed' | 'passed' | 'running' | 'none';

/**
 * What a run's line says at its end: how long it took, once known; how long it has been going, or its status while it
 * has not started (`queued`, `waiting`); the conclusion of one that says nothing (`cancelled`, `skipped`).
 */
export type WorkflowRunTail =
    | { readonly kind: 'duration'; readonly ms: number }
    | { readonly kind: 'running'; readonly ms: number }
    | { readonly kind: 'status'; readonly status: string }
    | { readonly kind: 'conclusion'; readonly conclusion: string }
    | null;

/** How a run's line describes it (actions W3b). */
export interface WorkflowRunDescription {
    readonly mark: WorkflowRunMark;
    readonly tail: WorkflowRunTail;
}

/**
 * How a run's line describes it (actions W3b): its mark and what it says at its end — a finished run's duration from
 * when it started running to its last change, known only when GitHub says when it started.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function describeWorkflowRun(run: GitHubWorkflowRun, now: number): WorkflowRunDescription {
    const started = run.runStartedAt === undefined ? null : Date.parse(run.runStartedAt);
    if (run.status !== 'completed') {
        return {
            mark: 'running',
            tail:
                run.status === 'in_progress' && started !== null
                    ? { kind: 'running', ms: now - started }
                    : { kind: 'status', status: run.status.replaceAll('_', ' ') },
        };
    }

    const verdict = getRunVerdict(run);
    if (verdict === null) {
        return {
            mark: 'none',
            tail: run.conclusion === null ? null : { kind: 'conclusion', conclusion: run.conclusion },
        };
    }

    return {
        mark: verdict,
        tail: started === null ? null : { kind: 'duration', ms: Date.parse(run.updatedAt) - started },
    };
}
