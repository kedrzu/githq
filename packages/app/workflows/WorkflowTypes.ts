import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';

/**
 * What githq keeps of a tracked repository's GitHub Actions (actions D2): its workflows and their latest counted
 * runs, plain data, rebuilt from GitHub at will. Whether a workflow is broken is not stored: it is worked out on
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
    /** In GitHub's order. */
    readonly workflows: readonly StoredWorkflow[];
    /**
     * When the last read finished (epoch ms) — a read GitHub refused too; `null` while nothing was read, which is not
     * the same as healthy.
     */
    readonly readAt: number | null;
    /** Why GitHub shows no workflow state for the repository, while it does not. */
    readonly unavailable: WorkflowsUnavailable | null;
}

/** A workflow and its latest runs on the refs that count. */
export interface StoredWorkflow {
    readonly workflow: GitHubWorkflow;
    /**
     * Its latest runs on the refs that count, merged by id from every query of its runs, the newest first, about
     * 20 of them (`mergeWorkflowRuns`).
     */
    readonly runs: readonly GitHubWorkflowRun[];
    /**
     * The ETag of each query of its runs' last 200, by query: `branch:<name>` for the runs on one branch or tag. A
     * query missing here was never read, or GitHub sent no ETag for it: it is read again.
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
 * Which refs light a repository's counters (actions D5, D14): its default branch, unless switched off, and the
 * patterns, in GitHub Actions' filter syntax (D13). `{ countDefaultBranch: true, patterns: [] }` by default.
 */
export interface WorkflowRefSettings {
    readonly countDefaultBranch: boolean;
    readonly patterns: readonly string[];
}

/** What a finished run says of its workflow (actions D1); a run that says nothing has none. */
export type RunVerdict = 'failed' | 'passed';

/**
 * How a workflow stands on the refs that count: `broken` and `passing` by its latest run with a verdict, `unknown`
 * with no such run stored, `disabled` when GitHub lists it as anything but active — it never counts.
 */
export type WorkflowStatus = 'broken' | 'passing' | 'unknown' | 'disabled';

/** A workflow's state, worked out from its stored runs. */
export interface WorkflowState {
    readonly workflow: GitHubWorkflow;
    readonly state: WorkflowStatus;
    /** GitHub generates it itself (Pages, Dependabot, CodeQL): there is no file in the repository to fix. */
    readonly generated: boolean;
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
    /** The latest 5 runs that count, oldest first, any verdict or none. */
    readonly lastRuns: readonly GitHubWorkflowRun[];
    /** The latest failed run that counts, which Enter opens; `null` unless broken. */
    readonly latestFailedRun: GitHubWorkflowRun | null;
    /** The latest run that counts and has not finished; `null` when none runs. */
    readonly runningRun: GitHubWorkflowRun | null;
}

/** A repository's workflows' states, and what its sidebar marker and the total need. */
export interface RepositoryWorkflowState {
    /** `unread` before the first read, `unavailable` while GitHub shows nothing: neither is healthy nor counts. */
    readonly status: 'unread' | 'unavailable' | 'read';
    /** In the stored order; empty unless `read`. */
    readonly workflows: readonly WorkflowState[];
    readonly brokenCount: number;
    /** The latest `breakStartedAt` of a broken workflow (epoch ms); `null` with none broken. */
    readonly newestBreakAt: number | null;
    /** Some workflow broke less than a day ago: the marker shows bright. */
    readonly hasNewBreak: boolean;
}
