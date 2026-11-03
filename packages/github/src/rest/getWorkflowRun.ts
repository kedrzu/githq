import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import { isGitHubGone } from '../utils/isGitHubGone.js';
import { conditionalGet } from './conditionalGet.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';
import { readWorkflowRun } from './readWorkflowRuns.js';
import type { GitHubWorkflowRun } from './readWorkflowRuns.js';

/** A run as its own answer gives it: what the lists do, and what a run's summary says besides. */
export interface GitHubWorkflowRunDetail extends GitHubWorkflowRun {
    /** The workflow's name at the time of the run; `null` when GitHub gives none. */
    readonly workflowName: string | null;
    /** The whole message of the commit it ran on; `null` when GitHub gives none. */
    readonly headCommitMessage: string | null;
    /** Who started it; `null` when GitHub gives none. */
    readonly actorLogin: string | null;
    /** Which attempt this is, from 1; `null` when GitHub gives none. */
    readonly runAttempt: number | null;
}

/** Which run to read, and the ETag of the last answer. */
export interface GetWorkflowRunParams {
    /** `owner/name`. */
    nameWithOwner: string;
    runId: number;
    etag?: string;
}

/** Nothing changed since the ETag (free), the run, or GitHub no longer has it. */
export type GetWorkflowRunResult =
    | { status: 304 }
    | {
          status: 200;
          /** `undefined` when GitHub sent none — the next call cannot be conditional. */
          etag: string | undefined;
          run: GitHubWorkflowRunDetail;
      }
    | { status: 'gone' };

/**
 * Reads one run of a repository's workflows (`GET /repos/{o}/{r}/actions/runs/{id}`) with `If-None-Match`.
 *
 * Throws {@link GitHubApiError} when GitHub refuses other than with "gone", or the answer is not a run.
 */
export async function getWorkflowRun(
    rest: GitHubRestRequester,
    params: GetWorkflowRunParams,
): Promise<GetWorkflowRunResult> {
    const { nameWithOwner, runId, etag } = params;
    try {
        const answer = await conditionalGet(rest, {
            url: `${getRepositoryRestPath(nameWithOwner)}/actions/runs/${runId}`,
            etag,
        });
        if (answer.status === 304) {
            return answer;
        }

        const { body } = answer;
        const run = readWorkflowRun(answer.status, body);
        return {
            status: 200,
            etag: answer.etag,
            run: {
                ...run,
                workflowName: isPlainObject(body) && typeof body.name === 'string' ? body.name : null,
                headCommitMessage: readHeadCommitMessage(body),
                actorLogin: readActorLogin(body),
                runAttempt: isPlainObject(body) && typeof body.run_attempt === 'number' ? body.run_attempt : null,
            },
        };
    } catch (error) {
        if (isGitHubGone(error)) {
            return { status: 'gone' };
        }

        throw error;
    }
}

function readHeadCommitMessage(body: unknown) {
    if (!isPlainObject(body) || !isPlainObject(body.head_commit)) {
        return null;
    }

    return typeof body.head_commit.message === 'string' ? body.head_commit.message : null;
}

function readActorLogin(body: unknown) {
    if (!isPlainObject(body) || !isPlainObject(body.actor)) {
        return null;
    }

    return typeof body.actor.login === 'string' ? body.actor.login : null;
}
