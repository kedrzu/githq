import type { TestGraphQLRequest, TestRestAnswer } from './createTestSession.js';

/** A workflow of the fake GitHub's repository. */
export interface ActionsWorldWorkflow {
    readonly id: number;
    readonly name: string;
    /** `active` unless the test turns it off (`disabled_manually`, …). */
    readonly state: string;
}

/** A run of the fake GitHub's repository; `run_number` and the URLs are made from its id. */
export interface ActionsWorldRun {
    readonly id: number;
    readonly workflowId: number;
    readonly headBranch: string | null;
    readonly event: string;
    readonly status: string;
    readonly conclusion: string | null;
    /** ISO. */
    readonly createdAt: string;
}

/** A job of a run in the fake GitHub, as GitHub answers it: `steps[]` with `started_at`, `completed_at`, …. */
export interface ActionsWorldJob {
    readonly id: number;
    readonly name: string;
    readonly status: string;
    readonly conclusion: string | null;
    readonly steps: readonly unknown[];
}

/** A repository's GitHub Actions in the fake GitHub; the test changes it between polls. */
export interface ActionsWorldRepository {
    defaultBranch: string;
    workflows: ActionsWorldWorkflow[];
    /** In any order: the lists answer the newest first. */
    runs: ActionsWorldRun[];
    /** The names of its tags. */
    tags: string[];
    /** A run's jobs, by the run's id; a run missing here has none. */
    jobs: Map<number, readonly ActionsWorldJob[]>;
    /** A job's log, or the error status its log answers with, by the job's id; one missing here answers 404. */
    logs: Map<number, string | number>;
    /** GitHub answers the repository's Actions with this error status instead (403, 404, 401, …); `null` for none. */
    refusal: number | null;
}

/**
 * GitHub Actions in the fake GitHub, answering what `WorkflowSync` asks: a repository's latest runs, the repository
 * itself (its default branch), its tags, its workflows and a workflow's runs (by `branch` or on any ref, a page at a
 * time with a `Link` to the next), and what `WorkflowRunStore` asks: a run, its jobs and a job's log. Each answer's ETag is a hash of its body, answered `304` while it is the one sent. A repository the test
 * never set up has no workflows, on `main`.
 */
export interface ActionsWorld {
    readonly repositories: Map<string, ActionsWorldRepository>;
    /** The repository's Actions, set up empty the first time. */
    repository(nameWithOwner: string): ActionsWorldRepository;
    /** The answer to an Actions request or a repository's `GET`; `undefined` for any other. */
    answerRest(request: TestGraphQLRequest): TestRestAnswer | undefined;
}

const API = 'https://api.github.com';

/** Creates the fake GitHub's Actions with no workflows anywhere. */
export function createActionsWorld(): ActionsWorld {
    const world: ActionsWorld = { repositories: new Map(), repository, answerRest };
    return world;

    function repository(nameWithOwner: string) {
        let found = world.repositories.get(nameWithOwner);
        if (!found) {
            found = {
                defaultBranch: 'main',
                workflows: [],
                runs: [],
                tags: [],
                jobs: new Map(),
                logs: new Map(),
                refusal: null,
            };
            world.repositories.set(nameWithOwner, found);
        }

        return found;
    }

    function answerRest(request: TestGraphQLRequest): TestRestAnswer | undefined {
        if (!request.operation.startsWith('GET ')) {
            return undefined;
        }

        const path = request.operation.slice('GET '.length);
        const runPath = /^\/repos\/([^/]+\/[^/]+)\/actions\/(?:runs\/(\d+)(\/jobs)?|jobs\/(\d+)\/logs)$/.exec(path);
        if (runPath?.[1] !== undefined) {
            return answerRun(request, repository(runPath[1]), runPath);
        }

        const match =
            /^\/repos\/([^/]+\/[^/]+)(\/actions\/runs|\/actions\/workflows|\/actions\/workflows\/(\d+)\/runs|\/git\/matching-refs\/tags)?$/.exec(
                path,
            );
        const nameWithOwner = match?.[1];
        if (!match || nameWithOwner === undefined) {
            return undefined;
        }

        const found = repository(nameWithOwner);
        const { variables } = request;
        const perPage = Number(variables.per_page ?? 30);
        if (match[2] === undefined) {
            return conditional(request, { default_branch: found.defaultBranch });
        }

        if (found.refusal !== null) {
            return { status: found.refusal, body: { message: 'Refused' } };
        }

        if (match[2] === '/git/matching-refs/tags') {
            return conditional(
                request,
                found.tags.map(tag => ({ ref: `refs/tags/${tag}`, object: { sha: `sha-${tag}`, type: 'commit' } })),
            );
        }

        if (match[2] === '/actions/runs') {
            const runs = newestFirst(found.runs).slice(0, perPage);
            return conditional(request, { total_count: found.runs.length, workflow_runs: runs.map(toRestRun) });
        }

        if (match[2] === '/actions/workflows') {
            return conditional(request, {
                total_count: found.workflows.length,
                workflows: found.workflows.map(workflow => ({
                    id: workflow.id,
                    node_id: `W_${workflow.id}`,
                    name: workflow.name,
                    path: `.github/workflows/${workflow.name.toLowerCase()}.yml`,
                    state: workflow.state,
                    html_url: `https://github.com/${nameWithOwner}/actions/workflows/${workflow.id}`,
                })),
            });
        }

        const workflowId = Number(match[3]);
        const branch = typeof variables.branch === 'string' ? variables.branch : null;
        const matching = newestFirst(found.runs).filter(
            run => run.workflowId === workflowId && (branch === null || run.headBranch === branch),
        );
        const page = Number(variables.page ?? 1);
        const runs = matching.slice((page - 1) * perPage, page * perPage);
        const answer = conditional(request, { total_count: matching.length, workflow_runs: runs.map(toRestRun) });
        if (page * perPage >= matching.length) {
            return answer;
        }

        const next = new URL(`${API}${path}`);
        if (branch !== null) {
            next.searchParams.set('branch', branch);
        }

        next.searchParams.set('per_page', String(perPage));
        next.searchParams.set('page', String(page + 1));
        return { ...answer, link: `<${next.href}>; rel="next"` };
    }
}

/** A run, its jobs or a job's log, from what {@link answerRest}'s pattern matched of the path. */
function answerRun(request: TestGraphQLRequest, found: ActionsWorldRepository, path: RegExpExecArray): TestRestAnswer {
    if (found.refusal !== null) {
        return { status: found.refusal, body: { message: 'Refused' } };
    }

    const [, , runId, jobs, jobId] = path;
    if (jobId !== undefined) {
        const log = found.logs.get(Number(jobId)) ?? 404;
        return typeof log === 'string' ? { status: 200, text: log } : { status: log, body: { message: 'Refused' } };
    }

    const run = found.runs.find(candidate => candidate.id === Number(runId));
    if (!run) {
        return { status: 404, body: { message: 'Not Found' } };
    }

    if (jobs === undefined) {
        return conditional(request, {
            ...toRestRun(run),
            name: 'Deploy',
            head_commit: { message: `Commit of run ${run.id}` },
            actor: { login: 'monalisa' },
        });
    }

    const list = found.jobs.get(run.id) ?? [];
    return conditional(request, {
        total_count: list.length,
        jobs: list.map(job => ({
            ...job,
            started_at: run.createdAt,
            completed_at: null,
            html_url: `https://github.com/acme/web/actions/runs/${run.id}/job/${job.id}`,
        })),
    });
}

/** `body` with an ETag hashed from it, or a 304 when the request sent that ETag. */
function conditional(request: TestGraphQLRequest, body: unknown): TestRestAnswer {
    const etag = `"${hash(JSON.stringify(body))}"`;
    return request.variables.ifNoneMatch === etag ? { status: 304, etag } : { status: 200, etag, body };
}

function newestFirst(runs: readonly ActionsWorldRun[]) {
    return runs.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

function toRestRun(run: ActionsWorldRun) {
    return {
        id: run.id,
        workflow_id: run.workflowId,
        run_number: run.id,
        head_branch: run.headBranch,
        head_sha: `sha${run.id}`,
        event: run.event,
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.createdAt,
        updated_at: run.createdAt,
        display_title: `Run ${run.id}`,
        html_url: `https://github.com/acme/web/actions/runs/${run.id}`,
    };
}

/** A short hash of `text` (djb2), as GitHub's ETags are hashes of the body. */
function hash(text: string) {
    let value = 5381;
    for (const char of text) {
        value = (Math.imul(value, 33) ^ (char.codePointAt(0) ?? 0)) >>> 0;
    }

    return value.toString(16);
}
