import { escapeRegExp } from '../utils/escapeRegExp.js';
import { etagOf } from '../utils/etagOf.js';

import type { GitHubMock, GitHubRestAnswer, GitHubRestRequest } from './GitHubMock.js';

/** A repository's GitHub Actions as the mock answers them. */
export interface GitHubActionsState {
    /** What GitHub calls the repository's default branch. */
    readonly defaultBranch: string;
    readonly workflows: readonly GitHubActionsWorkflow[];
    /** In any order: the lists answer the newest first. */
    readonly runs: readonly GitHubActionsRun[];
    /** The names of its tags. */
    readonly tags: readonly string[];
    /** A run's jobs, by the run's id; a run missing here has none. */
    readonly jobs: ReadonlyMap<number, readonly GitHubActionsJob[]>;
    /** How a job's log answers, by the job's id; one missing here answers 404. */
    readonly logs: ReadonlyMap<number, GitHubActionsLog>;
}

/** A job of a run. */
export interface GitHubActionsJob {
    readonly id: number;
    readonly name: string;
    /** `completed`, `in_progress`, … */
    readonly status: string;
    /** `success`, `failure`, …; `null` while it runs. */
    readonly conclusion: string | null;
    /** ISO; `null` before it starts. */
    readonly startedAt: string | null;
    /** ISO; `null` before it finishes. */
    readonly completedAt: string | null;
    readonly steps: readonly GitHubActionsStep[];
}

/** A step of a job. */
export interface GitHubActionsStep {
    readonly name: string;
    readonly number: number;
    /** `completed`, `in_progress`, … */
    readonly status: string;
    /** `success`, `failure`, `skipped`, …; `null` while it runs. */
    readonly conclusion: string | null;
    /** ISO, at whole seconds; `null` before it starts. */
    readonly startedAt: string | null;
    /** ISO, at whole seconds; `null` before it finishes. */
    readonly completedAt: string | null;
}

/** A job's log, plain text as GitHub keeps it, or the error status it answers with instead. */
export type GitHubActionsLog = string | number;

/** A workflow of a repository. */
export interface GitHubActionsWorkflow {
    readonly id: number;
    readonly name: string;
    /** `active`, `disabled_manually`, … */
    readonly state: string;
}

/** A run of a repository's workflow; its number and URLs are made from its id. */
export interface GitHubActionsRun {
    readonly id: number;
    readonly workflowId: number;
    /** The branch or tag it ran on. */
    readonly headBranch: string;
    /** `push`, `pull_request`, `schedule`, … */
    readonly event: string;
    /** `completed`, `in_progress`, … */
    readonly status: string;
    /** `success`, `failure`, `cancelled`, …; `null` while running. */
    readonly conclusion: string | null;
    /** ISO. */
    readonly createdAt: string;
    /** Which attempt it is on; the first without it. */
    readonly attempt?: number;
    /** Whose run it is: `monalisa` without it. */
    readonly actor?: string;
}

/** What a repository answers to the app's writes to its Actions; `404` for each one left out. */
export interface GitHubActionsWrites {
    /** `POST …/actions/runs/{id}/rerun-failed-jobs`. */
    readonly rerun?: (runId: number) => GitHubRestAnswer;
    /** `POST …/actions/runs/{id}/cancel`. */
    readonly cancel?: (runId: number) => GitHubRestAnswer;
    /** `PUT …/actions/workflows/{id}/enable` or `/disable`. */
    readonly setEnabled?: (workflowId: number, enabled: boolean) => GitHubRestAnswer;
}

/** A repository with no workflows, on `main`: what every tracked repository answers unless a test gives it some. */
export const NO_ACTIONS: GitHubActionsState = {
    defaultBranch: 'main',
    workflows: [],
    runs: [],
    tags: [],
    jobs: new Map(),
    logs: new Map(),
};

/**
 * Answers what the app reads of a tracked repository's GitHub Actions, from `read()` at each request: the
 * repository's latest runs (`GET /repos/{o}/{r}/actions/runs`), the repository itself for its default branch
 * (`GET /repos/{o}/{r}`), its tags (`…/git/matching-refs/tags`), its workflows (`…/actions/workflows`) and a
 * workflow's runs on any ref or filtered by `branch`, `event`, `status` and `actor` (`…/actions/workflows/{id}/runs`,
 * paged by `per_page` and `page`, a `Link` to the next page while more remain), a workflow's file (`…/contents/.github/workflows/<name>.yml`: run on push, one job), a run (`…/actions/runs/{id}`), its jobs (`…/runs/{id}/jobs`) and a
 * job's log (`…/actions/jobs/{id}/logs`, plain text), each `404` for an id it does not know; and the writes `writes` answers:
 * re-running a run's failed jobs, cancelling a run, turning a workflow on or off. Every JSON answer carries an ETag hashed from its body and is
 * `304` while it is the one the app sent back, as GitHub's are. A workflow's runs and file are answered once the list
 * named it.
 */
export function answerRepositoryActions(
    github: GitHubMock,
    nameWithOwner: string,
    read: () => GitHubActionsState,
    writes: GitHubActionsWrites = {},
): void {
    const base = `/repos/${nameWithOwner}`;
    const answered = new Set<number>();
    github.rest('GET', base, request =>
        conditional(request, { full_name: nameWithOwner, default_branch: read().defaultBranch }),
    );
    github.rest('GET', `${base}/actions/runs`, request => {
        const { runs } = read();
        return conditional(request, {
            total_count: runs.length,
            workflow_runs: newestFirst(runs)
                .slice(0, perPageOf(request))
                .map(run => toRestRun(nameWithOwner, run)),
        });
    });
    github.rest('GET', `${base}/git/matching-refs/tags`, request =>
        conditional(
            request,
            read().tags.map(tag => ({ ref: `refs/tags/${tag}`, object: { sha: tag, type: 'commit' } })),
        ),
    );
    github.rest('GET', `${base}/actions/workflows`, request => {
        const { workflows } = read();
        for (const { id, name } of workflows) {
            if (!answered.has(id)) {
                answered.add(id);
                github.rest('GET', `${base}/actions/workflows/${id}/runs`, runsRequest =>
                    answerWorkflowRuns(runsRequest, id),
                );
                github.rest('GET', `${base}/contents/${getWorkflowPath(name)}`, fileRequest =>
                    conditional(fileRequest, {
                        type: 'file',
                        path: getWorkflowPath(name),
                        encoding: 'base64',
                        content: Buffer.from(getWorkflowFile(name)).toString('base64'),
                    }),
                );
            }
        }

        return conditional(request, {
            total_count: workflows.length,
            workflows: workflows.map(workflow => ({
                id: workflow.id,
                node_id: `W_${workflow.id}`,
                name: workflow.name,
                path: getWorkflowPath(workflow.name),
                state: workflow.state,
                html_url: `https://github.com/${nameWithOwner}/actions/workflows/${workflow.name.toLowerCase()}.yml`,
            })),
        });
    });

    github.restMatching('GET', new RegExp(`^${escapeRegExp(base)}/actions/runs/(\\d+)$`), (request, match) => {
        const run = findRun(match);
        return run
            ? conditional(request, {
                  ...toRestRun(nameWithOwner, run),
                  name: read().workflows.find(workflow => workflow.id === run.workflowId)?.name ?? null,
                  head_commit: { message: `Run ${run.id}` },
                  run_attempt: run.attempt ?? 1,
                  actor: { login: run.actor ?? ACTOR },
              })
            : NOT_FOUND;
    });
    github.restMatching(
        'POST',
        new RegExp(`^${escapeRegExp(base)}/actions/runs/(\\d+)/rerun-failed-jobs$`),
        (_, match) => writes.rerun?.(Number(match[1])) ?? NOT_FOUND,
    );
    github.restMatching('POST', new RegExp(`^${escapeRegExp(base)}/actions/runs/(\\d+)/cancel$`), (_, match) =>
        writes.cancel ? writes.cancel(Number(match[1])) : NOT_FOUND,
    );
    github.restMatching(
        'PUT',
        new RegExp(`^${escapeRegExp(base)}/actions/workflows/(\\d+)/(enable|disable)$`),
        (_, match) => writes.setEnabled?.(Number(match[1]), match[2] === 'enable') ?? NOT_FOUND,
    );
    github.restMatching('GET', new RegExp(`^${escapeRegExp(base)}/actions/runs/(\\d+)/jobs$`), (request, match) => {
        const run = findRun(match);
        if (!run) {
            return NOT_FOUND;
        }

        const jobs = read().jobs.get(run.id) ?? [];
        return conditional(request, {
            total_count: jobs.length,
            jobs: jobs.map(job => toRestJob(nameWithOwner, run, job)),
        });
    });
    github.restMatching('GET', new RegExp(`^${escapeRegExp(base)}/actions/jobs/(\\d+)/logs$`), (_, match) => {
        const log = read().logs.get(Number(match[1])) ?? 404;
        return typeof log === 'string' ? { status: 200, text: log } : { status: log, json: { message: 'Refused' } };
    });

    function findRun(match: RegExpExecArray) {
        return read().runs.find(run => run.id === Number(match[1]));
    }

    function answerWorkflowRuns(request: GitHubRestRequest, workflowId: number) {
        const { searchParams } = request.url;
        const branch = searchParams.get('branch');
        const event = searchParams.get('event');
        const status = searchParams.get('status');
        const actor = searchParams.get('actor');
        const matching = newestFirst(read().runs).filter(
            run =>
                run.workflowId === workflowId &&
                (branch === null || run.headBranch === branch) &&
                (event === null || run.event === event) &&
                (status === null || run.status === status || run.conclusion === status) &&
                (actor === null || (run.actor ?? ACTOR) === actor),
        );
        const perPage = perPageOf(request);
        const page = Number(searchParams.get('page') ?? 1);
        const answer = conditional(request, {
            total_count: matching.length,
            workflow_runs: matching
                .slice((page - 1) * perPage, page * perPage)
                .map(run => toRestRun(nameWithOwner, run)),
        });
        if (page * perPage >= matching.length) {
            return answer;
        }

        // GitHub's next page keeps the query, filters and page size included.
        const next = new URL(request.url);
        next.searchParams.set('page', String(page + 1));
        return { ...answer, link: `<${next.href}>; rel="next"` };
    }
}

const NOT_FOUND: GitHubRestAnswer = { status: 404, json: { message: 'Not Found' } };
/** Who a run is credited to unless it names someone. */
const ACTOR = 'monalisa';

/** Where the workflow `name`'s file is in its repository. */
function getWorkflowPath(name: string) {
    return `.github/workflows/${name.toLowerCase()}.yml`;
}

/** The workflow `name`'s file: run on every push, one job. */
function getWorkflowFile(name: string) {
    return [
        `name: ${name}`,
        'on: push',
        'jobs:',
        '  build:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - run: echo ok',
        '',
    ].join('\n');
}

function conditional(request: GitHubRestRequest, json: unknown): GitHubRestAnswer {
    const etag = etagOf(json);
    return request.ifNoneMatch === etag ? { status: 304, etag } : { status: 200, json, etag };
}

function perPageOf(request: GitHubRestRequest) {
    return Number(request.url.searchParams.get('per_page') ?? 30);
}

function newestFirst(runs: readonly GitHubActionsRun[]) {
    return runs.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

function toRestRun(nameWithOwner: string, run: GitHubActionsRun) {
    return {
        id: run.id,
        workflow_id: run.workflowId,
        run_number: run.id,
        head_branch: run.headBranch,
        head_sha: String(run.id).padStart(40, '0'),
        event: run.event,
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.createdAt,
        updated_at: run.createdAt,
        display_title: `Run ${run.id}`,
        actor: { login: run.actor ?? ACTOR, avatar_url: `https://avatars.githubusercontent.com/${run.actor ?? ACTOR}` },
        html_url: `https://github.com/${nameWithOwner}/actions/runs/${run.id}`,
    };
}

function toRestJob(nameWithOwner: string, run: GitHubActionsRun, job: GitHubActionsJob) {
    return {
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        started_at: job.startedAt,
        completed_at: job.completedAt,
        html_url: `https://github.com/${nameWithOwner}/actions/runs/${run.id}/job/${job.id}`,
        steps: job.steps.map(step => ({
            name: step.name,
            number: step.number,
            status: step.status,
            conclusion: step.conclusion,
            started_at: step.startedAt,
            completed_at: step.completedAt,
        })),
    };
}
