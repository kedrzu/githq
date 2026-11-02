import type { RepositoryWorkflows, WorkflowRefSettings, WorkflowState } from '../WorkflowTypes.js';
import { getKnownRefs } from './getKnownRefs.js';
import type { KnownRef } from './getKnownRefs.js';
import { getRepositoryWorkflowState } from './getRepositoryWorkflowState.js';
import { getWorkflowPatterns } from './getWorkflowPatterns.js';
import { getWorkflowReadProgress } from './getWorkflowReadProgress.js';
import { isRefCounted } from './isRefCounted.js';
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
    /**
     * The active workflows the candidate would make broken that are not now, in GitHub's order, as the candidate
     * would judge them: where and when they failed.
     */
    readonly turnBroken: readonly WorkflowState[];
    /** The workflows broken now that the candidate would no longer count as broken, in GitHub's order, as now. */
    readonly stopCounting: readonly WorkflowState[];
    /** The known refs that count now and would not under the candidate, the latest run first. */
    readonly stopMatching: readonly KnownRef[];
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
    // Until the first read finishes, what the runs read so far match says nothing (W10).
    const known = stored !== undefined && getWorkflowReadProgress(stored) === null ? getKnownRefs(stored) : [];
    // How new a break is plays no part here.
    const before = getRepositoryWorkflowState(stored, current, 0).workflows;
    const after = getRepositoryWorkflowState(stored, candidate, 0).workflows;
    const turnBroken: WorkflowState[] = [];
    const stopCounting: WorkflowState[] = [];
    for (const [index, workflow] of after.entries()) {
        const previous = before[index];
        const wasBroken = previous?.state === 'broken';
        const isBroken = workflow.state === 'broken';
        if (isBroken && !wasBroken) {
            turnBroken.push(workflow);
        } else if (previous && wasBroken && !isBroken) {
            stopCounting.push(previous);
        }
    }

    const defaultBranch = stored?.defaultBranch ?? null;

    return {
        patterns: getWorkflowPatterns(candidate).map(pattern => ({
            pattern,
            refs: known.filter(ref => matchRefPattern(pattern, ref.name)),
        })),
        turnBroken,
        stopCounting,
        stopMatching: known.filter(
            ref =>
                isRefCounted({ settings: current, defaultBranch, ref: ref.name }) &&
                !isRefCounted({ settings: candidate, defaultBranch, ref: ref.name }),
        ),
    };
}
