import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { assertValue } from '@nzyme/utils/assert.js';

import { getRepositoryWorkflowState } from '@/workflows/utils/getRepositoryWorkflowState.js';
import type { TrackedRepositoryWorkflowState } from '@/workflows/WorkflowStore.js';
import type {
    RepositoryWorkflows,
    StoredWorkflow,
    WorkflowRefSettings,
    WorkflowState,
    WorkflowsUnavailable,
} from '@/workflows/WorkflowTypes.js';

/** What the sample workflows' ages are counted to: 2026-11-02, 12:00 UTC. */
export const SAMPLE_WORKFLOWS_NOW = Date.parse('2026-11-02T12:00:00Z');

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** The refs the samples count: `main` and the tags `v*`. */
const SAMPLE_REFS: WorkflowRefSettings = { defaultBranch: true, refs: ['v*'] };

/** A sample run, by its conclusion and how long before {@link SAMPLE_WORKFLOWS_NOW} it was created. */
export interface SampleRun {
    /** `success`, `failure`, `cancelled`, …; `null` for a run still going. */
    readonly conclusion: string | null;
    /** How long ago, in minutes (`m`), hours (`h`) or days (`d`): `14m`, `3h`, `4d`. */
    readonly ago: `${number}${'d' | 'h' | 'm'}`;
    /** `main` unless given: the default branch, which counts; a version (`v0.1.0`) is a tag. */
    readonly branch?: string;
    /** `push` unless given; `pull_request` for one a pull request started. */
    readonly event?: string;
    /** Its title (the commit's or the pull request's); none unless given. */
    readonly title?: string;
    /** How long it ran, in seconds, from its creation; not known unless given. */
    readonly seconds?: number;
}

/** A sample workflow and its runs. */
export interface SampleWorkflowParams {
    readonly id: number;
    readonly name: string;
    /** `.github/workflows/<name>.yml` unless given; `dynamic/…` for one GitHub generates. */
    readonly path?: string;
    /** `active` unless given. */
    readonly state?: string;
    /** Oldest first. */
    readonly runs: readonly SampleRun[];
    /** `fitloop/webapp` unless given. */
    readonly repository?: string;
    /** Its runs were read, though none is given: GitHub lists none. */
    readonly read?: boolean;
    /**
     * Where its runs' ids and numbers start counting, 0 unless given: older runs read apart from the kept ones count
     * from below it (`-20`).
     */
    readonly firstRun?: number;
}

/**
 * A workflow's state as `getRepositoryWorkflowState` works it out from sample runs, at {@link SAMPLE_WORKFLOWS_NOW},
 * counting `main` and the tags `v*`, each in its own group.
 */
export function sampleWorkflowState(params: SampleWorkflowParams): WorkflowState {
    const repository = params.repository ?? 'fitloop/webapp';
    const state = getRepositoryWorkflowState(sampleStored(repository, [params]), SAMPLE_REFS, SAMPLE_WORKFLOWS_NOW);

    return assertValue(state.workflows[0]);
}

/** A sample tracked repository's workflows ({@link sampleRepositoryWorkflows}). */
export interface SampleRepositoryParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    /** Its workflows; their `repository` is this one. */
    readonly workflows?: readonly SampleWorkflowParams[];
    /** Its workflows were never read. */
    readonly unread?: boolean;
    /** GitHub shows nothing of its workflows. */
    readonly unavailable?: WorkflowsUnavailable;
}

/**
 * A tracked repository's workflows as the cross-repository screen reads them, at {@link SAMPLE_WORKFLOWS_NOW},
 * counting `main` and the tags `v*`.
 */
export function sampleRepositoryWorkflows(params: SampleRepositoryParams): TrackedRepositoryWorkflowState {
    const state = getRepositoryWorkflowState(sampleStoredWorkflows(params), SAMPLE_REFS, SAMPLE_WORKFLOWS_NOW);
    return { nameWithOwner: params.nameWithOwner, state };
}

/** What `WorkflowStore` keeps of a sample tracked repository's workflows; `undefined` when `unread`. */
export function sampleStoredWorkflows(params: SampleRepositoryParams): RepositoryWorkflows | undefined {
    if (params.unread) {
        return undefined;
    }

    return {
        ...sampleStored(params.nameWithOwner, params.workflows ?? []),
        unavailable: params.unavailable ?? null,
    };
}

function sampleStored(repository: string, workflows: readonly SampleWorkflowParams[]): RepositoryWorkflows {
    const refs = workflows.flatMap(params => params.runs.map(run => run.branch ?? 'main'));
    return {
        nameWithOwner: repository,
        defaultBranch: 'main',
        repositoryEtag: null,
        runsEtag: null,
        workflowsEtag: null,
        tagsEtag: null,
        workflows: workflows.map(params => sampleStoredWorkflow(repository, params)),
        tags: [...new Set(refs.filter(ref => /^v\d+\./.test(ref)))],
        unavailable: null,
    };
}

/** A sample workflow's runs, the newest first, as GitHub lists them; in `fitloop/webapp` unless its `repository` is given. */
export function sampleWorkflowRuns(params: SampleWorkflowParams): readonly GitHubWorkflowRun[] {
    return sampleStoredWorkflow(params.repository ?? 'fitloop/webapp', params).runs;
}

function sampleStoredWorkflow(repository: string, params: SampleWorkflowParams): StoredWorkflow {
    const runs = params.runs.map((sample, index): GitHubWorkflowRun => {
        const number = (params.firstRun ?? 0) + index;
        const id = params.id * 1000 + number + 1;
        const createdAt = SAMPLE_WORKFLOWS_NOW - toMs(sample.ago);
        return {
            id,
            workflowId: params.id,
            runNumber: 200 + number,
            headBranch: sample.branch ?? 'main',
            event: sample.event ?? 'push',
            status: sample.conclusion === null ? 'in_progress' : 'completed',
            conclusion: sample.conclusion,
            createdAt: new Date(createdAt).toISOString(),
            htmlUrl: `https://github.com/${repository}/actions/runs/${id}`,
            headSha: `${id}`.padStart(40, '0'),
            ...(sample.title !== undefined && { displayTitle: sample.title }),
            ...(sample.seconds !== undefined && {
                runStartedAt: new Date(createdAt).toISOString(),
                updatedAt: new Date(createdAt + sample.seconds * 1000).toISOString(),
            }),
        };
    });

    return {
        workflow: {
            id: params.id,
            name: params.name,
            path: params.path ?? `.github/workflows/${params.name.toLowerCase()}.yml`,
            state: params.state ?? 'active',
            htmlUrl: `https://github.com/${repository}/actions/workflows/${params.id}`,
        },
        runs: runs.toReversed(),
        etags: params.read ? { 'branch:main': '"read"' } : {},
    };
}

function toMs(ago: SampleRun['ago']) {
    const count = Number(ago.slice(0, -1));
    switch (ago.at(-1)) {
        case 'd':
            return count * DAY;
        case 'h':
            return count * HOUR;
        default:
            return count * MINUTE;
    }
}

/** The workflows of the design's screens W2 and W3a, at {@link SAMPLE_WORKFLOWS_NOW}. */
export const SAMPLE_WORKFLOWS = {
    /** Broke 3 hours ago, three failures since the last pass: bright red. */
    deploy: sampleWorkflowState({
        id: 1,
        name: 'Deploy',
        runs: [
            { conclusion: 'success', ago: '30h' },
            { conclusion: 'success', ago: '20h' },
            { conclusion: 'failure', ago: '3h' },
            { conclusion: 'failure', ago: '1h' },
            { conclusion: 'failure', ago: '14m' },
        ],
    }),
    /** Broken on the tags `v*` for 4 days, a cancelled run in the middle changing nothing: quiet red. */
    release: sampleWorkflowState({
        id: 2,
        name: 'Release',
        runs: [
            { conclusion: 'success', ago: '9d', branch: 'v0.1.0' },
            { conclusion: 'success', ago: '6d', branch: 'v0.1.1' },
            { conclusion: 'failure', ago: '4d', branch: 'v0.2.0-rc.1' },
            { conclusion: 'cancelled', ago: '3d', branch: 'v0.2.0-rc.2' },
            { conclusion: 'failure', ago: '3d', branch: 'v0.2.0-rc.3' },
        ],
    }),
    /** Failing for longer than its stored runs go back, and a new run going. */
    nightly: sampleWorkflowState({
        id: 3,
        name: 'Nightly',
        runs: [
            { conclusion: 'failure', ago: '4d' },
            { conclusion: 'failure', ago: '3d' },
            { conclusion: 'failure', ago: '2d' },
            { conclusion: 'failure', ago: '23h' },
            { conclusion: null, ago: '2m' },
        ],
    }),
    /** Generated by GitHub, broken for weeks. */
    dependabot: sampleWorkflowState({
        id: 4,
        name: 'Dependabot Updates',
        path: 'dynamic/dependabot/dependabot-updates',
        runs: [
            { conclusion: 'failure', ago: '22d' },
            { conclusion: 'failure', ago: '15d' },
            { conclusion: 'failure', ago: '8d' },
            { conclusion: 'failure', ago: '4d' },
            { conclusion: 'failure', ago: '2d' },
        ],
    }),
    /** Passing, with a run going. */
    probe: sampleWorkflowState({
        id: 5,
        name: 'Probe',
        runs: [
            { conclusion: 'success', ago: '4h' },
            { conclusion: 'success', ago: '3h' },
            { conclusion: 'success', ago: '2h' },
            { conclusion: 'success', ago: '11m' },
            { conclusion: null, ago: '1m' },
        ],
    }),
    /** Passing, one run cancelled. */
    test: sampleWorkflowState({
        id: 6,
        name: 'Test',
        runs: [
            { conclusion: 'success', ago: '5h' },
            { conclusion: 'cancelled', ago: '4h' },
            { conclusion: 'success', ago: '3h' },
            { conclusion: 'success', ago: '1h' },
            { conclusion: 'success', ago: '14m' },
        ],
    }),
    /** Two runs known: a failure, healed. */
    lint: sampleWorkflowState({
        id: 7,
        name: 'Lint',
        runs: [
            { conclusion: 'failure', ago: '2d' },
            { conclusion: 'success', ago: '1d' },
        ],
    }),
    /** Disabled on GitHub: never counts, its last runs still shown. */
    backup: sampleWorkflowState({
        id: 8,
        name: 'Nightly backup',
        state: 'disabled_inactivity',
        runs: [
            { conclusion: 'failure', ago: '82d' },
            { conclusion: 'success', ago: '81d' },
        ],
    }),
    /** No run known yet. */
    codeql: sampleWorkflowState({ id: 9, name: 'CodeQL', path: 'dynamic/github-code-scanning/codeql', runs: [] }),
} satisfies Record<string, WorkflowState>;

/**
 * A repository's workflows as its Workflows tab shows them in the design's W13, one of each kind of row, counting the
 * default branch `main`: Deploy broken, CLA run only by pull requests, Release failed on a tag and Nightly e2e on a
 * branch without alerts, Probe and Dependabot passing, Nightly backup disabled.
 */
export const SAMPLE_TAB_WORKFLOWS: readonly SampleWorkflowParams[] = [
    {
        id: 1,
        name: 'Deploy',
        runs: [
            { conclusion: 'success', ago: '30h' },
            { conclusion: 'success', ago: '20h' },
            { conclusion: 'failure', ago: '3h' },
            { conclusion: 'failure', ago: '1h' },
            { conclusion: 'failure', ago: '14m' },
        ],
    },
    {
        id: 2,
        name: 'CLA',
        runs: [
            { conclusion: 'success', ago: '2h', branch: 'feature', event: 'pull_request_target' },
            { conclusion: 'failure', ago: '1h', branch: 'feature', event: 'pull_request_target' },
            { conclusion: 'success', ago: '12m', branch: 'other', event: 'pull_request' },
        ],
    },
    {
        id: 3,
        name: 'Release',
        runs: [
            { conclusion: 'success', ago: '2d', branch: 'v0.1.0-rc.1' },
            { conclusion: 'failure', ago: '6h', branch: 'v0.1.0-rc.3' },
        ],
    },
    { id: 4, name: 'Nightly e2e', runs: [{ conclusion: 'failure', ago: '6h', branch: 'staging' }] },
    {
        id: 5,
        name: 'Probe',
        runs: [
            { conclusion: 'success', ago: '2h' },
            { conclusion: 'success', ago: '11m' },
            { conclusion: null, ago: '1m' },
        ],
    },
    {
        id: 6,
        name: 'Dependabot Updates',
        path: 'dynamic/dependabot/dependabot-updates',
        runs: [{ conclusion: 'success', ago: '3d' }],
    },
    {
        id: 7,
        name: 'Nightly backup',
        state: 'disabled_inactivity',
        runs: [{ conclusion: 'failure', ago: '82d' }],
    },
];
