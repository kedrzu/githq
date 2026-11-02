import { assertNever } from '@nzyme/utils/assertNever.js';
import { assertValue } from '@nzyme/utils/assert.js';

import { getKnownRefs } from './utils/getKnownRefs.js';
import type { KnownRef } from './utils/getKnownRefs.js';
import { getRepositoryWorkflowState } from './utils/getRepositoryWorkflowState.js';
import { getWorkflowPatterns } from './utils/getWorkflowPatterns.js';
import { getWorkflowReadProgress } from './utils/getWorkflowReadProgress.js';
import { isRefCounted } from './utils/isRefCounted.js';
import { isWorkflowAlertsOff } from './utils/isWorkflowAlertsOff.js';
import { matchRefPattern } from './utils/matchRefPattern.js';
import { previewWorkflowSettings } from './utils/previewWorkflowSettings.js';
import type {
    RefKind,
    RepositoryWorkflowState,
    RepositoryWorkflows,
    RunVerdict,
    WorkflowRefGroup,
    WorkflowRefSettings,
    WorkflowRowRef,
    WorkflowState,
} from './WorkflowTypes.js';

/** How many refs without alerts the card lists (`Workflow alerts / List`). */
const OTHER_REF_LIMIT = 3;

/** The Workflow alerts section of a repository's settings (actions T16, W7–W10), worked out from the local copy. */
export interface WorkflowAlerts {
    /** githq has read the repository's runs: what the patterns match is known. */
    readonly read: boolean;
    /** Nothing raises alerts here: the default branch is off and there are no patterns (W9). */
    readonly alertsOff: boolean;
    readonly defaultBranch: WorkflowAlertsDefaultBranch;
    /** In the user's order. */
    readonly patterns: readonly WorkflowAlertsPattern[];
    /** Known refs nothing counts, the latest run first, at most three. */
    readonly otherRefs: readonly WorkflowAlertsOtherRef[];
}

/** The default branch's row (`Workflow alerts / Default branch`). */
export interface WorkflowAlertsDefaultBranch {
    /** It raises alerts. */
    readonly on: boolean;
    /** Its name as GitHub reports it; `null` before the first read. */
    readonly name: string | null;
    /** The names of the workflows that ran on it, in GitHub's order. */
    readonly workflows: readonly string[];
    /** Workflows broken on it; `null` when not known, or while it is off. */
    readonly brokenCount: number | null;
}

/** A pattern's row (`Workflow alerts / Pattern row`). */
export interface WorkflowAlertsPattern {
    readonly pattern: string;
    readonly matches: PatternMatches;
    /** Workflows broken on the refs it matches; `null` when not known. */
    readonly brokenCount: number | null;
}

/** What a pattern matches of the refs githq has seen runs on. */
export interface PatternMatches {
    /** The refs, branches first, then tags, each the latest run first. */
    readonly refs: readonly KnownRef[];
    readonly branchCount: number;
    readonly tagCount: number;
    /** The names of the workflows that ran on them, in GitHub's order. */
    readonly workflows: readonly string[];
    /**
     * It catches both kinds: those of the fewer kind, named so the user can tell whether it is meant ("v2-experiment is
     * a branch"); `null` when it catches one kind.
     */
    readonly flagged: { readonly kind: RefKind; readonly names: readonly string[] } | null;
}

/** A known ref without alerts (`Workflow alerts / Ref without alerts`). */
export interface WorkflowAlertsOtherRef {
    readonly ref: KnownRef;
    /** The latest failure of a workflow failing there, else its latest run with a verdict, else its latest run. */
    readonly latest: {
        readonly workflow: string;
        readonly verdict: RunVerdict | null;
        readonly at: number;
    };
}

/** What {@link buildWorkflowAlerts} works from. */
export interface BuildWorkflowAlertsParams {
    /** What is stored of the repository's workflows; `undefined` before the first read. */
    readonly stored: RepositoryWorkflows | undefined;
    /** The settings in force. */
    readonly settings: WorkflowRefSettings;
    /** Epoch ms "new" is told against. */
    readonly now: number;
}

/**
 * The Workflow alerts section of a repository's settings (actions D5, D13, T16): the default branch and each pattern,
 * what each matches of the refs githq has seen runs on and how many workflows are broken there, and the other refs
 * with recent runs that raise no alert. Until the first read of the runs finishes nothing is matched and nothing
 * counted — not zero —, while the default branch is named from the moment it is known (W10).
 * @__NO_SIDE_EFFECTS__
 */
export function buildWorkflowAlerts(params: BuildWorkflowAlertsParams): WorkflowAlerts {
    const { stored, settings, now } = params;
    const read = stored !== undefined && getWorkflowReadProgress(stored) === null;
    const known = read ? getKnownRefs(stored) : [];
    const state = getRepositoryWorkflowState(stored, settings, now);
    const defaultName = stored?.defaultBranch ?? null;
    const patterns = getWorkflowPatterns(settings);

    return {
        read,
        alertsOff: isWorkflowAlertsOff(settings),
        defaultBranch: {
            on: settings.defaultBranch,
            name: defaultName,
            workflows: known.find(ref => ref.name === defaultName)?.workflows.map(entry => entry.workflow.name) ?? [],
            brokenCount:
                settings.defaultBranch && defaultName !== null
                    ? countBroken(state, { kind: 'defaultBranch', branch: defaultName })
                    : null,
        },
        patterns: patterns.map(pattern => ({
            pattern,
            matches: getPatternMatches(
                stored,
                known.filter(ref => matchRefPattern(pattern, ref.name)),
            ),
            brokenCount: countBroken(state, { kind: 'pattern', pattern }),
        })),
        otherRefs: known
            .filter(ref => !isRefCounted({ settings, defaultBranch: defaultName, ref: ref.name }))
            .slice(0, OTHER_REF_LIMIT)
            .map(ref => ({ ref, latest: getLatest(ref) })),
    };
}

/** What adding a pattern, or changing one, would do (W11, W12). */
export type PatternEditPreview =
    /** Nothing typed: Enter does nothing. */
    | { readonly kind: 'empty' }
    /** Another pattern in the list already: Enter does nothing. */
    | { readonly kind: 'duplicate' }
    | {
          readonly kind: 'preview';
          /** The settings saving it writes. */
          readonly settings: WorkflowRefSettings;
          readonly matches: PatternMatches;
          /** Workflows that would turn broken, with where and when they failed. */
          readonly turnBroken: readonly PatternEditBreak[];
          /** The names of workflows broken now that would no longer count as broken. */
          readonly stopCounting: readonly string[];
          /** Known refs that count now and would not. */
          readonly stopMatching: readonly KnownRef[];
          /**
           * The names of the workflows broken on its refs both before and after, when nothing turns broken or stops
           * counting: the counters stay as they are.
           */
          readonly staysBroken: readonly string[];
      };

/** A workflow a pattern would make broken. */
export interface PatternEditBreak {
    readonly workflow: string;
    /** The ref of its latest failed run; `null` when not known. */
    readonly ref: WorkflowRowRef | null;
    /** When that run was created (epoch ms); `null` when not known. */
    readonly at: number | null;
}

/** What {@link previewPatternEdit} compares. */
export interface PreviewPatternEditParams {
    readonly stored: RepositoryWorkflows | undefined;
    /** The settings in force. */
    readonly settings: WorkflowRefSettings;
    /** The pattern being changed, by its index in `settings.refs`; `null` for a new one. */
    readonly index: number | null;
    /** What is typed. */
    readonly value: string;
}

/**
 * What saving a pattern being typed would change, re-run on every keystroke (actions W11, W12): what it matches of the
 * refs githq has seen runs on, which workflows turn broken or stop counting, and which refs stop counting. Surrounding
 * spaces are not part of it.
 * @__NO_SIDE_EFFECTS__
 */
export function previewPatternEdit(params: PreviewPatternEditParams): PatternEditPreview {
    const { stored, settings, index, value } = params;
    const pattern = value.trim();
    if (!pattern) {
        return { kind: 'empty' };
    }

    if (settings.refs.some((other, otherIndex) => other === pattern && otherIndex !== index)) {
        return { kind: 'duplicate' };
    }

    const refs = index === null ? [...settings.refs, pattern] : settings.refs.with(index, pattern);
    const candidate: WorkflowRefSettings = { defaultBranch: settings.defaultBranch, refs };
    const preview = previewWorkflowSettings({ stored, current: settings, candidate });
    const matches = preview.patterns.find(entry => entry.pattern === pattern)?.refs ?? [];
    const changed = preview.turnBroken.length > 0 || preview.stopCounting.length > 0;

    return {
        kind: 'preview',
        settings: candidate,
        matches: getPatternMatches(stored, matches),
        turnBroken: preview.turnBroken.map(state => {
            const group = state.brokenGroups[0];
            const run = group?.latestFailedRun ?? null;
            return {
                workflow: state.workflow.name,
                ref: group?.failedRef ?? null,
                at: run ? Date.parse(run.createdAt) : null,
            };
        }),
        stopCounting: preview.stopCounting.map(state => state.workflow.name),
        stopMatching: preview.stopMatching,
        staysBroken: changed ? [] : getBrokenOn({ stored, settings: candidate, pattern }),
    };
}

/**
 * What a pattern matches of the known refs, in the order its row shows them: branches first — the kind a tag pattern
 * catches by mistake —, then tags, each the latest run first.
 */
function getPatternMatches(stored: RepositoryWorkflows | undefined, refs: readonly KnownRef[]): PatternMatches {
    const branches = refs.filter(ref => ref.kind === 'branch');
    const tags = refs.filter(ref => ref.kind === 'tag');
    const ran = new Set(refs.flatMap(ref => ref.workflows.map(entry => entry.workflow.id)));

    let flagged: PatternMatches['flagged'] = null;
    if (branches.length > 0 && tags.length > 0) {
        flagged =
            branches.length <= tags.length
                ? { kind: 'branch', names: branches.map(ref => ref.name) }
                : { kind: 'tag', names: tags.map(ref => ref.name) };
    }

    return {
        refs: [...branches, ...tags],
        branchCount: branches.length,
        tagCount: tags.length,
        workflows: (stored?.workflows ?? [])
            .filter(entry => ran.has(entry.workflow.id))
            .map(entry => entry.workflow.name),
        flagged,
    };
}

/** How many workflows are broken in a group; `null` until the runs are read and while GitHub shows nothing. */
function countBroken(state: RepositoryWorkflowState, group: WorkflowRefGroup): number | null {
    if (state.status !== 'read' || state.reading) {
        return null;
    }

    return state.workflows.filter(workflow => isBrokenIn(workflow, group)).length;
}

/** What {@link getBrokenOn} looks at. */
interface GetBrokenOnParams {
    readonly stored: RepositoryWorkflows | undefined;
    readonly settings: WorkflowRefSettings;
    readonly pattern: string;
}

function getBrokenOn({ stored, settings, pattern }: GetBrokenOnParams) {
    // How new a break is plays no part here.
    const state = getRepositoryWorkflowState(stored, settings, 0);
    return state.workflows
        .filter(workflow => isBrokenIn(workflow, { kind: 'pattern', pattern }))
        .map(workflow => workflow.workflow.name);
}

function isBrokenIn(workflow: WorkflowState, group: WorkflowRefGroup) {
    return workflow.brokenGroups.some(broken => isSameGroup(broken.group, group));
}

function isSameGroup(a: WorkflowRefGroup, b: WorkflowRefGroup) {
    switch (a.kind) {
        case 'defaultBranch':
            return b.kind === 'defaultBranch';
        case 'pattern':
            return b.kind === 'pattern' && a.pattern === b.pattern;
        default:
            return assertNever(a);
    }
}

/**
 * What a ref without alerts says of its runs: a workflow failing there, its latest failure — a failure is what the
 * user looks here for —, else its latest verdict, else its latest run.
 */
function getLatest(ref: KnownRef): WorkflowAlertsOtherRef['latest'] {
    let failed: WorkflowAlertsOtherRef['latest'] | null = null;
    let decided: WorkflowAlertsOtherRef['latest'] | null = null;
    for (const entry of ref.workflows) {
        if (entry.verdictAt === null) {
            continue;
        }

        const latest = { workflow: entry.workflow.name, verdict: entry.verdict, at: entry.verdictAt };
        if (entry.verdict === 'failed' && (failed === null || latest.at > failed.at)) {
            failed = latest;
        }

        if (decided === null || latest.at > decided.at) {
            decided = latest;
        }
    }

    // A known ref has a run of some workflow.
    return (
        failed ??
        decided ?? { workflow: assertValue(ref.workflows[0]).workflow.name, verdict: null, at: ref.latestRunAt }
    );
}
