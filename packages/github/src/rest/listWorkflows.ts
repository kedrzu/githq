import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import { readNextPageUrl } from '../utils/readNextPageUrl.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** Which repository to look at, and the ETag of the last answer. */
export interface ListWorkflowsParams {
    /** `owner/name`. */
    nameWithOwner: string;
    /** The ETag the last 200 returned; GitHub answers 304, free of quota, while nothing changed. */
    etag?: string;
}

/** Nothing changed since the ETag (free), or every workflow of the repository. */
export type ListWorkflowsResult =
    | { status: 304 }
    | {
          status: 200;
          /** The first page's ETag; `undefined` when GitHub sent none. */
          etag: string | undefined;
          workflows: GitHubWorkflow[];
      };

/** A GitHub Actions workflow of a repository, as `workflows[]` gives it, cut to what githq keeps. */
export interface GitHubWorkflow {
    readonly id: number;
    readonly name: string;
    /** `.github/workflows/deploy.yml`; `dynamic/…` for one GitHub generates itself (Pages, Dependabot, CodeQL). */
    readonly path: string;
    /** `active`, `disabled_manually`, `disabled_inactivity`, `disabled_fork`, `deleted`, … */
    readonly state: string;
    readonly htmlUrl: string;
}

/**
 * Lists a repository's workflows (`GET /repos/{o}/{r}/actions/workflows`), the first page with `If-None-Match`: a
 * 304 is free of quota and ends the call. On a 200 the pages after it, rare at 100 a page, follow the `Link` header.
 *
 * Throws {@link GitHubApiError} when GitHub refuses or an answer is not a list of workflows.
 */
export async function listWorkflows(
    rest: GitHubRestRequester,
    params: ListWorkflowsParams,
): Promise<ListWorkflowsResult> {
    const first = await rest({
        url: `${getRepositoryRestPath(params.nameWithOwner)}/actions/workflows`,
        query: { per_page: '100' },
        etag: params.etag,
    });
    if (first.status === 304) {
        return { status: 304 };
    }

    const workflows = readWorkflows(first.status, first.payload);
    let next = readNextPageUrl(first.headers);
    while (next !== undefined) {
        const page = await rest({ url: next });
        workflows.push(...readWorkflows(page.status, page.payload));
        next = readNextPageUrl(page.headers);
    }

    return { status: 200, etag: first.headers.get('etag') ?? undefined, workflows };
}

function readWorkflows(status: number, payload: unknown) {
    if (!isPlainObject(payload) || !Array.isArray(payload.workflows)) {
        throw malformed(status);
    }

    const workflows: GitHubWorkflow[] = [];
    for (const entry of payload.workflows) {
        if (
            !isPlainObject(entry) ||
            typeof entry.id !== 'number' ||
            typeof entry.name !== 'string' ||
            typeof entry.path !== 'string' ||
            typeof entry.state !== 'string' ||
            typeof entry.html_url !== 'string'
        ) {
            throw malformed(status);
        }

        workflows.push({
            id: entry.id,
            name: entry.name,
            path: entry.path,
            state: entry.state,
            htmlUrl: entry.html_url,
        });
    }

    return workflows;
}

function malformed(status: number) {
    return new GitHubApiError({ status, message: 'GitHub workflow list answer is malformed' });
}
