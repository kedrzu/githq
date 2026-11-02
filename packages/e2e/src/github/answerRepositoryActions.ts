import { etagOf } from '../utils/etagOf.js';

import type { GitHubMock, GitHubRestAnswer, GitHubRestRequest } from './GitHubMock.js';

/** A repository's GitHub Actions as the mock answers them. */
export interface GitHubActionsState {
    /** What GitHub calls the repository's default branch. */
    readonly defaultBranch: string;
    readonly workflows: readonly GitHubActionsWorkflow[];
    /** In any order: the lists answer the newest first. */
    readonly runs: readonly GitHubActionsRun[];
}

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
}

/** A repository with no workflows, on `main`: what every tracked repository answers unless a test gives it some. */
export const NO_ACTIONS: GitHubActionsState = { defaultBranch: 'main', workflows: [], runs: [] };

/**
 * Answers what the app reads of a tracked repository's GitHub Actions, from `read()` at each request: the
 * repository's latest runs (`GET /repos/{o}/{r}/actions/runs`), the repository itself for its default branch
 * (`GET /repos/{o}/{r}`), its workflows (`…/actions/workflows`) and a workflow's runs by `branch`
 * (`…/actions/workflows/{id}/runs`, one page, no `Link`). Every answer carries an ETag hashed from its body and is
 * `304` while it is the one the app sent back, as GitHub's are. A workflow's runs are answered once the list named it.
 */
export function answerRepositoryActions(
    github: GitHubMock,
    nameWithOwner: string,
    read: () => GitHubActionsState,
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
    github.rest('GET', `${base}/actions/workflows`, request => {
        const { workflows } = read();
        for (const { id } of workflows) {
            if (!answered.has(id)) {
                answered.add(id);
                github.rest('GET', `${base}/actions/workflows/${id}/runs`, runsRequest =>
                    answerWorkflowRuns(runsRequest, id),
                );
            }
        }

        return conditional(request, {
            total_count: workflows.length,
            workflows: workflows.map(workflow => ({
                id: workflow.id,
                node_id: `W_${workflow.id}`,
                name: workflow.name,
                path: `.github/workflows/${workflow.name.toLowerCase()}.yml`,
                state: workflow.state,
                html_url: `https://github.com/${nameWithOwner}/actions/workflows/${workflow.name.toLowerCase()}.yml`,
            })),
        });
    });

    function answerWorkflowRuns(request: GitHubRestRequest, workflowId: number) {
        const branch = request.url.searchParams.get('branch');
        const matching = newestFirst(read().runs).filter(
            run => run.workflowId === workflowId && (branch === null || run.headBranch === branch),
        );
        return conditional(request, {
            total_count: matching.length,
            workflow_runs: matching.slice(0, perPageOf(request)).map(run => toRestRun(nameWithOwner, run)),
        });
    }
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
        html_url: `https://github.com/${nameWithOwner}/actions/runs/${run.id}`,
    };
}
