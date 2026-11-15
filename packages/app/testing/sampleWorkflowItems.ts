import type { GitHubWorkflowFileParse } from '@githq/github/workflows/parseWorkflowFile.js';
import { assertValue } from '@nzyme/utils/assert.js';

import { buildWorkflowDetails } from '@/workflows/buildWorkflowDetails.js';
import type { WorkflowDetails } from '@/workflows/buildWorkflowDetails.js';
import { getRefGroups } from '@/workflows/utils/getRefGroups.js';
import { NO_WORKFLOW_RUN_FILTERS } from '@/workflows/WorkflowRunHistory.js';
import type {
    WorkflowRunFilters,
    WorkflowRunHistoryStatus,
    WorkflowRunsBrowse,
} from '@/workflows/WorkflowRunHistory.js';
import type { WorkflowRefGroup, WorkflowState } from '@/workflows/WorkflowTypes.js';

import { sampleStoredWorkflows, sampleWorkflowState } from './sampleWorkflows.js';
import type { SampleWorkflowParams } from './sampleWorkflows.js';

/** An opened workflow as the workflow view takes it. */
export interface SampleWorkflowItem {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly state: WorkflowState;
    readonly details: WorkflowDetails;
    readonly runs: WorkflowRunsBrowse;
    readonly refGroups: readonly WorkflowRefGroup[];
    readonly tags: readonly string[];
}

/** What {@link sampleWorkflowItem} opens. */
export interface SampleWorkflowItemParams {
    readonly workflow: SampleWorkflowParams;
    /** Its file as read at the default branch; not read yet unless given. Left out for a generated one. */
    readonly file?: GitHubWorkflowFileParse;
    /** The filters set on its runs, and the runs they let through; none unless given. */
    readonly filters?: WorkflowRunFilters;
    /** Every run was read; `true` unless given. */
    readonly complete?: boolean;
    /** `idle` unless given. */
    readonly status?: WorkflowRunHistoryStatus;
}

/**
 * A sample workflow opened as an item, at `SAMPLE_WORKFLOWS_NOW`, counting `main` and the tags `v*`: its state, its
 * details and its runs — the newest first, those the filters let through.
 */
export function sampleWorkflowItem(params: SampleWorkflowItemParams): SampleWorkflowItem {
    const nameWithOwner = params.workflow.repository ?? 'fitloop/webapp';
    const stored = assertValue(sampleStoredWorkflows({ nameWithOwner, workflows: [params.workflow] }));
    const state = sampleWorkflowState(params.workflow);
    const filters = params.filters ?? NO_WORKFLOW_RUN_FILTERS;
    const runs = assertValue(stored.workflows[0]).runs.filter(
        run =>
            (filters.ref === null || run.headBranch === filters.ref) &&
            (filters.event === null || run.event === filters.event) &&
            (filters.actor === null || run.actor?.login === filters.actor),
    );

    return {
        nameWithOwner,
        state,
        details: buildWorkflowDetails({
            stored,
            state,
            file: { parse: params.file ?? null, status: 'idle' },
            runs,
        }),
        runs: {
            runs,
            status: params.status ?? 'idle',
            complete: params.complete ?? true,
            filters,
            seeded: false,
        },
        refGroups: getRefGroups({ defaultBranch: true, refs: ['v*'] }, 'main'),
        tags: stored.tags,
    };
}

/** Deploy's file: pushes to `main`, pull requests into it, and a dispatch with three inputs. */
const DEPLOY_FILE: GitHubWorkflowFileParse = {
    kind: 'parsed',
    file: {
        triggers: [
            { event: 'push', branches: ['main'] },
            { event: 'workflow_dispatch' },
            { event: 'pull_request', branches: ['main'] },
        ],
        dispatch: {
            inputs: [
                {
                    name: 'environment',
                    type: 'choice',
                    required: true,
                    default: 'staging',
                    options: ['staging', 'production'],
                },
                { name: 'version', type: 'string', required: false },
                { name: 'dry_run', type: 'boolean', required: false, default: true },
            ],
        },
        callOnly: false,
    },
};

/** The design's opened workflows (actions W30–W33), at `SAMPLE_WORKFLOWS_NOW`. */
export const SAMPLE_WORKFLOW_ITEMS = {
    /** Broken on `main` for 3h, last passed yesterday; one run going; dispatchable (W30, W31). */
    deploy: sampleWorkflowItem({
        workflow: {
            id: 11,
            name: 'Deploy',
            runs: [
                {
                    conclusion: 'success',
                    ago: '3d',
                    title: 'Group recurring classes by week',
                    seconds: 238,
                    actor: 'sofiab',
                },
                {
                    conclusion: 'success',
                    ago: '2d',
                    event: 'workflow_dispatch',
                    title: 'Show the waiting list on the class page',
                    seconds: 249,
                    actor: 'rhu',
                },
                {
                    conclusion: 'failure',
                    ago: '27h',
                    branch: 'chore/deploy-workflow',
                    title: 'Try a second deploy target',
                    seconds: 80,
                    actor: 'mlaine',
                },
                {
                    conclusion: 'cancelled',
                    ago: '26h',
                    branch: 'chore/deploy-workflow',
                    event: 'workflow_dispatch',
                    title: 'Try a second deploy target',
                    actor: 'mlaine',
                },
                {
                    conclusion: 'success',
                    ago: '25h',
                    title: 'Fix the timezone on recurring classes',
                    seconds: 251,
                    actor: 'rhu',
                },
                {
                    conclusion: 'success',
                    ago: '4h',
                    branch: 'sofiab/tokens',
                    event: 'pull_request',
                    title: 'Move design tokens into the ui package',
                    seconds: 242,
                    actor: 'sofiab',
                },
                {
                    conclusion: 'failure',
                    ago: '3h',
                    title: 'Add a stale-while-revalidate cache to the API client',
                    seconds: 178,
                    actor: 'mlaine',
                },
                { conclusion: 'failure', ago: '1h', title: 'Bump vite to 7.1.7', seconds: 220, actor: 'dkim' },
                {
                    conclusion: 'failure',
                    ago: '14m',
                    title: 'Move design tokens into the ui package',
                    seconds: 192,
                    actor: 'sofiab',
                },
                { conclusion: null, ago: '1m', title: 'Retry the cache warmup on deploy', actor: 'dkim' },
            ],
        },
        file: DEPLOY_FILE,
    }),
    /** Passing on `main`, its runs filtered to one branch (W32). */
    filtered: sampleWorkflowItem({
        workflow: {
            id: 12,
            name: 'Test',
            runs: [
                { conclusion: 'success', ago: '6h', title: 'Fix the timezone', seconds: 110, actor: 'rhu' },
                {
                    conclusion: 'success',
                    ago: '4h',
                    branch: 'sofiab/tokens',
                    event: 'pull_request',
                    title: 'Move design tokens into the ui package',
                    seconds: 108,
                    actor: 'sofiab',
                },
                { conclusion: 'success', ago: '2h', title: 'Bump vite to 7.1.7', seconds: 104, actor: 'dkim' },
            ],
        },
        file: { kind: 'parsed', file: { triggers: [{ event: 'push' }], dispatch: null, callOnly: false } },
        filters: { ...NO_WORKFLOW_RUN_FILTERS, ref: 'sofiab/tokens' },
    }),
    /** Only pull requests run it, and its file has no `workflow_dispatch` (W33). */
    cla: sampleWorkflowItem({
        workflow: {
            id: 13,
            name: 'CLA',
            runs: [
                {
                    conclusion: 'failure',
                    ago: '2h',
                    branch: 'dkim/vite',
                    event: 'pull_request',
                    title: 'Bump vite',
                    seconds: 20,
                },
                {
                    conclusion: 'success',
                    ago: '12m',
                    branch: 'sofiab/tokens',
                    event: 'pull_request',
                    title: 'Move design tokens into the ui package',
                    seconds: 18,
                },
            ],
        },
        file: {
            kind: 'parsed',
            file: {
                triggers: [{ event: 'pull_request', branches: ['main'] }],
                dispatch: null,
                callOnly: false,
            },
        },
    }),
    /** GitHub generates it: there is no file to read. */
    generated: sampleWorkflowItem({
        workflow: {
            id: 14,
            name: 'pages-build-deployment',
            path: 'dynamic/pages/pages-build-deployment',
            runs: [{ conclusion: 'success', ago: '5h', title: 'pages build and deployment', seconds: 41 }],
        },
    }),
    /** Read, with no run at all. */
    noRuns: sampleWorkflowItem({
        workflow: { id: 15, name: 'Nightly backup', runs: [], read: true },
        file: {
            kind: 'parsed',
            file: { triggers: [{ event: 'schedule' }], dispatch: null, callOnly: false },
        },
    }),
};
