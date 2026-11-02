import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';

import type { RepositoryWorkflows, WorkflowRefSettings } from '../WorkflowTypes.js';
import { getKnownRefs } from './getKnownRefs.js';
import type { KnownRef } from './getKnownRefs.js';
import { getRepositoryWorkflowState } from './getRepositoryWorkflowState.js';
import { matchRefPattern } from './matchRefPattern.js';

/** What {@link previewWorkflowSettings} compares. */
export interface PreviewWorkflowSettingsParams {
    /** What is stored of the repository's workflows; `undefined` before the first read, when nothing is known. */
    readonly stored: RepositoryWorkflows | undefined;
    /** The settings in force. */
    readonly current: WorkflowRefSettings;
    /** The settings the user is about to save. */
    readonly candidate: WorkflowRefSettings;
}

/** What a candidate value of a repository's `workflows` setting would count, from runs githq already knows. */
export interface WorkflowSettingsPreview {
    /** Each of the candidate's patterns, in its order, with the known refs it matches. */
    readonly patterns: readonly PatternPreview[];
    /** The active workflows the candidate would make broken that are not now, in GitHub's order. */
    readonly turnBroken: readonly GitHubWorkflow[];
    /** The workflows broken now that the candidate would no longer count as broken, in GitHub's order. */
    readonly stopCounting: readonly GitHubWorkflow[];
}

/** A pattern and the known refs it matches, the latest run first; none can mean none had a recent run. */
export interface PatternPreview {
    readonly pattern: string;
    readonly refs: readonly KnownRef[];
}

/**
 * Tells what saving a candidate value of a repository's `workflows` setting would change (actions D13, the ref
 * patterns' screen): which known refs each pattern matches — branches and tags alike, so `v*` catching a branch shows
 * — and which workflows would turn broken or stop counting. Only refs with a recent run are known.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function previewWorkflowSettings(params: PreviewWorkflowSettingsParams): WorkflowSettingsPreview {
    const { stored, current, candidate } = params;
    const known = getKnownRefs(stored);
    // How new a break is plays no part here.
    const before = getRepositoryWorkflowState(stored, current, 0).workflows;
    const after = getRepositoryWorkflowState(stored, candidate, 0).workflows;
    const turnBroken: GitHubWorkflow[] = [];
    const stopCounting: GitHubWorkflow[] = [];
    for (const [index, workflow] of after.entries()) {
        const wasBroken = before[index]?.state === 'broken';
        const isBroken = workflow.state === 'broken';
        if (isBroken && !wasBroken) {
            turnBroken.push(workflow.workflow);
        } else if (wasBroken && !isBroken) {
            stopCounting.push(workflow.workflow);
        }
    }

    return {
        patterns: [...new Set(candidate.refs)].map(pattern => ({
            pattern,
            refs: known.filter(ref => matchRefPattern(pattern, ref.name)),
        })),
        turnBroken,
        stopCounting,
    };
}
