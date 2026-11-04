import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

/**
 * What githq keeps of a tracked repository's GitHub Actions (actions D2): its workflows, their latest runs and its
 * tags, plain data, rebuilt from GitHub at will. Whether a workflow is broken is not stored: it is worked out on
 * read ({@link RepositoryWorkflowState}), so a changed pattern needs no invalidation.
 */
export interface RepositoryWorkflows {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    /** The branch GitHub calls the default one, as last read; `null` before the first read (actions D5). */
    readonly defaultBranch: string | null;
    /** The ETag of the repository's last REST 200, which carried `defaultBranch`. */
    readonly repositoryEtag: string | null;
    /** The ETag of the repository's run list's last 200 — the change signal. */
    readonly runsEtag: string | null;
    /** The ETag of the workflow list's last 200. */
    readonly workflowsEtag: string | null;
    /** The ETag of the tag list's last 200. */
    readonly tagsEtag: string | null;
    /** In GitHub's order. */
    readonly workflows: readonly StoredWorkflow[];
    /** The names of the repository's tags, as last read: a run's ref is a tag when named here, a branch otherwise. */
    readonly tags: readonly string[];
    /** Why GitHub shows no workflow state for the repository, while it does not. */
    readonly unavailable: WorkflowsUnavailable | null;
}

/** A workflow and its latest runs. */
export interface StoredWorkflow {
    readonly workflow: GitHubWorkflow;
    /**
     * Its latest runs, merged by id from every query of its runs — on the default branch, and on any ref — the newest
     * first: the latest 20 and each counted group's deciding run (`mergeWorkflowRuns`).
     */
    readonly runs: readonly GitHubWorkflowRun[];
    /**
     * The ETag of each query of its runs' last 200, by query: `branch:<name>` for the runs on one branch or tag,
     * `any:<patterns>` for its runs on any ref while those patterns count. A query missing here was never read, or
     * GitHub sent no ETag for it: it is read again.
     */
    readonly etags: Readonly<Record<string, string>>;
}

/** GitHub shows no workflow state for a repository: Actions is turned off there, or GitHub refuses to say. */
export interface WorkflowsUnavailable {
    readonly reason: 'disabled' | 'refused';
    /** The HTTP status GitHub answered with. */
    readonly status: number;
}

/**
 * Which refs light a repository's counters (actions D5, D14), as its settings entry's `workflows` holds it: its
 * default branch, unless switched off, and the patterns, in GitHub Actions' filter syntax (D13), in the user's order.
 * `{ defaultBranch: true, refs: [] }` by default.
 */
export interface WorkflowRefSettings {
    /** Whether the branch GitHub calls the default one counts, whatever its name. */
    readonly defaultBranch: boolean;
    readonly refs: readonly string[];
}

/**
 * Refs whose runs are judged together (actions D1): the default branch, or the refs a pattern matches. A pass in one
 * group never hides a failure in another.
 */
export type WorkflowRefGroup =
    | { readonly kind: 'defaultBranch'; readonly branch: string }
    | { readonly kind: 'pattern'; readonly pattern: string };

/** What a finished run says of its workflow (actions D1); a run that says nothing has none. */
export type RunVerdict = 'failed' | 'passed';

/**
 * How a workflow stands on the refs that count: `broken` and `passing` by its latest run with a verdict, `unknown`
 * with no such run stored, `disabled` when GitHub lists it as anything but active — it never counts.
 */
export type WorkflowStatus = 'broken' | 'passing' | 'unknown' | 'disabled';

/** Where a workflow is broken, or since when: in one group, or, for the workflow, in its newest broken group. */
export interface WorkflowBreak {
    /**
     * When the break started (epoch ms): the creation of the oldest failed run after the last passed one stored, or
     * of the oldest failure stored when no pass is. `null` unless broken.
     */
    readonly breakStartedAt: number | null;
    /**
     * A pass is stored before the break, so it started at `breakStartedAt`; otherwise it started then or earlier, past
     * the runs stored ("Broken for 4+ days"). `false` unless broken.
     */
    readonly breakStartKnown: boolean;
    /** Broken for less than a day. */
    readonly isNew: boolean;
    /** The latest failed run, which Enter opens; `null` unless broken. */
    readonly latestFailedRun: GitHubWorkflowRun | null;
}

/** How a workflow stands in one counted group. */
export interface WorkflowGroupState extends WorkflowBreak {
    readonly group: WorkflowRefGroup;
    /** By the latest run in the group with a verdict; `unknown` — never `passing` — while none is stored. */
    readonly state: 'broken' | 'passing' | 'unknown';
    /** The ref {@link latestFailedRun} is on, with its kind; `null` unless broken. */
    readonly failedRef: WorkflowRowRef | null;
}

/** A workflow's state, worked out from its stored runs. */
export interface WorkflowState extends WorkflowBreak {
    readonly workflow: GitHubWorkflow;
    /**
     * `broken` when any counted group is, else `passing` when any group is, else `unknown`; `disabled` whatever its
     * runs. Its break is that of its newest broken group (the first of {@link brokenGroups}).
     */
    readonly state: WorkflowStatus;
    /** GitHub generates it itself (Pages, Dependabot, CodeQL): there is no file in the repository to fix. */
    readonly generated: boolean;
    /** How it stands in each counted group, in the settings' order: the default branch first. Empty when disabled. */
    readonly groups: readonly WorkflowGroupState[];
    /** The broken ones of {@link groups}, the newest break first: the row names the first, and "+n" for the others. */
    readonly brokenGroups: readonly WorkflowGroupState[];
    /** The latest 5 runs that count in any group, oldest first, any verdict or none. */
    readonly lastRuns: readonly GitHubWorkflowRun[];
}

/** Whether a ref is a branch or a tag. */
export type RefKind = 'branch' | 'tag';

/** The ref or pattern a row's workflow is read on, as the row names it. */
export interface WorkflowRowRef {
    /** `main`, `v*`. */
    readonly name: string;
    readonly kind: RefKind;
}

/** How far the read of a repository's workflows' runs is: "2 of 6 workflows". */
export interface WorkflowReadProgress {
    /** The active workflows whose runs were read. */
    readonly read: number;
    /** Its active workflows. */
    readonly total: number;
}

/** A repository's workflows' states, and what its sidebar marker and the total need. */
export interface RepositoryWorkflowState {
    /**
     * `unread` while nothing is stored of it, `unavailable` while GitHub shows nothing: neither is healthy nor
     * counts.
     */
    readonly status: 'unread' | 'unavailable' | 'read';
    /** Why GitHub shows nothing, while `unavailable`; `null` otherwise. */
    readonly unavailable: WorkflowsUnavailable | null;
    /**
     * Some active workflow's runs were never read while a ref counts: the workflows are listed, but what it counts may
     * be short and nothing claims it healthy. `false` unless `read`.
     */
    readonly reading: boolean;
    /** In the stored order; empty unless `read`. */
    readonly workflows: readonly WorkflowState[];
    readonly brokenCount: number;
    /** Some workflow broke less than a day ago: the marker shows bright. */
    readonly hasNewBreak: boolean;
}

/**
 * Where a repository's Workflows tab places a workflow its state alone does not (actions W3a, W13, W14): one whose
 * runs were all started by pull requests, one failing only on refs without alerts, one passing there, one with no
 * verdict yet — `reading` while its runs were never read.
 */
export type WorkflowRowStanding =
    | { readonly kind: 'pullRequestsOnly'; readonly failedCount: number }
    | {
          readonly kind: 'noAlerts';
          /** The ref its latest failure is on; `null` when GitHub names none. */
          readonly ref: WorkflowRowRef | null;
          readonly alertsOff: boolean;
      }
    | { readonly kind: 'passing' }
    | { readonly kind: 'notKnown'; readonly reading: boolean };
