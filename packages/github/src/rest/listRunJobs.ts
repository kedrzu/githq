import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import { isGitHubGone } from '../utils/isGitHubGone.js';
import { readNextPageUrl } from '../utils/readNextPageUrl.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** A step of a job. Step numbers have gaps, and a skipped step has no lines in the log. */
export interface GitHubWorkflowStep {
    /** Not the text of its log: `Component tests` begins at `##[group]Run bun nx run-many …`. */
    readonly name: string;
    readonly number: number;
    /** `queued`, `in_progress`, `completed`, … */
    readonly status: string;
    /** `success`, `failure`, `skipped`, …; `null` while it has not finished. */
    readonly conclusion: string | null;
    /** ISO, at whole seconds, which steps may share; `null` before it starts. */
    readonly startedAt: string | null;
    /** ISO, at whole seconds; `null` before it finishes. */
    readonly completedAt: string | null;
}

/** A job of a workflow run. */
export interface GitHubWorkflowJob {
    readonly id: number;
    readonly name: string;
    /** `queued`, `in_progress`, `completed`, `waiting`, … */
    readonly status: string;
    /** `success`, `failure`, `cancelled`, `skipped`, …; `null` while it has not finished. */
    readonly conclusion: string | null;
    /** ISO; `null` before it starts. */
    readonly startedAt: string | null;
    /** ISO; `null` before it finishes. */
    readonly completedAt: string | null;
    /** In GitHub's order; none before the job starts. */
    readonly steps: readonly GitHubWorkflowStep[];
}

/** Whose jobs to list, and the ETag of the last answer. */
export interface ListRunJobsParams {
    /** `owner/name`. */
    nameWithOwner: string;
    runId: number;
    /** The ETag of the last 200, if it had one: only an answer of one page has. */
    etag?: string;
}

/** The jobs did not change since the ETag (free), the jobs, or GitHub no longer has the run. */
export type ListRunJobsResult =
    | { status: 304 }
    | {
          status: 200;
          /**
           * `undefined` when GitHub sent none, or there was a next page: a 304 on the first page says nothing of a job
           * on another, which would stay "running" for good (W4j). The next call is then not conditional.
           */
          etag: string | undefined;
          /** Of every page. Empty for a run whose workflow file is invalid (actions D3). */
          jobs: GitHubWorkflowJob[];
      }
    | { status: 'gone' };

/**
 * Lists a run's jobs and their steps (`GET /repos/{o}/{r}/actions/runs/{id}/jobs`), every page. With an ETag it asks
 * `If-None-Match`: a 304 is free of quota. Only a run whose jobs fit one page gets one to ask with.
 *
 * Throws {@link GitHubApiError} when GitHub refuses other than with "gone", or the answer is not a list of jobs.
 */
export async function listRunJobs(rest: GitHubRestRequester, params: ListRunJobsParams): Promise<ListRunJobsResult> {
    const { nameWithOwner, runId, etag } = params;
    try {
        const first = await rest({
            url: `${getRepositoryRestPath(nameWithOwner)}/actions/runs/${runId}/jobs`,
            query: { per_page: '100' },
            etag,
            // Polled while a run goes: GitHub marks the answer cacheable for a minute, and with no ETag held the browser would serve it.
            cache: 'no-store',
        });
        if (first.status === 304) {
            return { status: 304 };
        }

        const jobs = readJobs(first.status, first.payload);
        const firstNextPageUrl = readNextPageUrl(first.headers);
        let nextPageUrl = firstNextPageUrl;
        while (nextPageUrl !== undefined) {
            const page = await rest({ url: nextPageUrl, cache: 'no-store' });
            jobs.push(...readJobs(page.status, page.payload));
            nextPageUrl = readNextPageUrl(page.headers);
        }

        return {
            status: 200,
            etag: firstNextPageUrl === undefined ? (first.headers.get('etag') ?? undefined) : undefined,
            jobs,
        };
    } catch (error) {
        if (isGitHubGone(error)) {
            return { status: 'gone' };
        }

        throw error;
    }
}

function readJobs(status: number, payload: unknown) {
    if (!isPlainObject(payload) || !Array.isArray(payload.jobs)) {
        throw malformed(status);
    }

    const jobs: GitHubWorkflowJob[] = [];
    for (const entry of payload.jobs) {
        if (
            !isPlainObject(entry) ||
            typeof entry.id !== 'number' ||
            typeof entry.name !== 'string' ||
            typeof entry.status !== 'string' ||
            !isTextOrNothing(entry.conclusion) ||
            !isTextOrNothing(entry.started_at) ||
            !isTextOrNothing(entry.completed_at) ||
            !(entry.steps === undefined || Array.isArray(entry.steps))
        ) {
            throw malformed(status);
        }

        jobs.push({
            id: entry.id,
            name: entry.name,
            status: entry.status,
            conclusion: entry.conclusion ?? null,
            startedAt: entry.started_at ?? null,
            completedAt: entry.completed_at ?? null,
            steps: readSteps(status, entry.steps ?? []),
        });
    }

    return jobs;
}

function readSteps(status: number, entries: readonly unknown[]) {
    const steps: GitHubWorkflowStep[] = [];
    for (const entry of entries) {
        if (
            !isPlainObject(entry) ||
            typeof entry.name !== 'string' ||
            typeof entry.number !== 'number' ||
            typeof entry.status !== 'string' ||
            !isTextOrNothing(entry.conclusion) ||
            !isTextOrNothing(entry.started_at) ||
            !isTextOrNothing(entry.completed_at)
        ) {
            throw malformed(status);
        }

        steps.push({
            name: entry.name,
            number: entry.number,
            status: entry.status,
            conclusion: entry.conclusion ?? null,
            startedAt: entry.started_at ?? null,
            completedAt: entry.completed_at ?? null,
        });
    }

    return steps;
}

function isTextOrNothing(value: unknown): value is string | null | undefined {
    return value == null || typeof value === 'string';
}

function malformed(status: number) {
    return new GitHubApiError({ status, message: 'GitHub run jobs answer is malformed' });
}
