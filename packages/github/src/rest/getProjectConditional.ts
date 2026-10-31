import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { conditionalGet } from './conditionalGet.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** Which project to look at, and the ETag of the last answer. */
export interface GetProjectConditionalParams {
    /** The project owner's kind: it picks `/users/…` or `/orgs/…`. */
    ownerKind: 'user' | 'org';
    /** The owner's login. */
    owner: string;
    /** The project's number within its owner. */
    number: number;
    /** The ETag the last 200 returned; GitHub answers 304, free of quota, while nothing changed. */
    etag?: string;
}

/** Nothing changed since the ETag (free), or the project changed, with the ETag to send next time. */
export type GetProjectConditionalResult =
    | { status: 304 }
    | {
          status: 200;
          /** `undefined` when GitHub sent none — the next call cannot be conditional. */
          etag: string | undefined;
          /** The project's GraphQL node id. */
          nodeId: string;
          updatedAt: string;
      };

/**
 * `GET`s a tracked project over REST with `If-None-Match` (`/users/{u}/projectsV2/{n}` or
 * `/orgs/{org}/projectsV2/{n}`) — the project loop's change signal (D7). Its ETag moves on a field edit of an
 * item and on an edit of an issue inside, which the repositories' issue lists do not see; a 304 is free of
 * quota. GitHub picks API version 2022-11-28 for these paths without being asked.
 *
 * Throws {@link GitHubApiError} on a 404 (the project is gone, or hidden from the token) and when the answer
 * is not a project.
 */
export async function getProjectConditional(
    rest: GitHubRestRequester,
    params: GetProjectConditionalParams,
): Promise<GetProjectConditionalResult> {
    const { ownerKind, owner, number, etag } = params;
    const base = ownerKind === 'user' ? 'users' : 'orgs';
    const answer = await conditionalGet(rest, {
        url: `/${base}/${encodeURIComponent(owner)}/projectsV2/${number}`,
        etag,
    });
    if (answer.status === 304) {
        return answer;
    }

    const { body } = answer;
    if (!isPlainObject(body) || typeof body.node_id !== 'string' || typeof body.updated_at !== 'string') {
        throw new GitHubApiError({ status: answer.status, message: 'GitHub project answer is malformed' });
    }

    return { status: 200, etag: answer.etag, nodeId: body.node_id, updatedAt: body.updated_at };
}
