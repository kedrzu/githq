import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import type { GitHubAnswer } from '../sendGitHubRequest.js';
import { decodeBase64Text } from '../utils/decodeBase64Text.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import { isGitHubGone } from '../utils/isGitHubGone.js';
import { parseWorkflowFile } from '../workflows/parseWorkflowFile.js';
import type { GitHubWorkflowFileParse } from '../workflows/parseWorkflowFile.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** Which workflow file to read, at which ref, and the ETag of the last answer. */
export interface ReadWorkflowFileParams {
    /** `owner/name`. */
    nameWithOwner: string;
    /** The file's path in the repository, as a workflow's `path` gives it (`.github/workflows/ci.yml`). */
    path: string;
    /** A branch, tag or commit; the default branch when absent. */
    ref?: string;
    /** The ETag the last 200 returned; GitHub answers 304, free of quota, while the file did not change. */
    etag?: string;
}

/** Nothing changed since the ETag (free), or the file read — `missing` when there is none at that ref. */
export type ReadWorkflowFileResult =
    | { status: 304 }
    | {
          status: 200;
          /** `undefined` when GitHub sent none, or there is no file — the next call cannot be conditional. */
          etag: string | undefined;
          workflow: GitHubWorkflowFileParse;
      };

/**
 * Reads and parses one workflow file at a ref (`GET /repos/{o}/{r}/contents/{path}?ref=`) with `If-None-Match`; a
 * 304 is free of quota. No file at that path, or a directory there, reads as `missing`.
 *
 * Throws {@link GitHubApiError} when GitHub refuses other than with "not found", or the answer holds no file content.
 */
export async function readWorkflowFile(
    rest: GitHubRestRequester,
    params: ReadWorkflowFileParams,
): Promise<ReadWorkflowFileResult> {
    const { nameWithOwner, path, ref, etag } = params;
    let answer: GitHubAnswer;
    try {
        answer = await rest({
            url: `${getRepositoryRestPath(nameWithOwner)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,
            query: ref === undefined ? {} : { ref },
            etag,
            // Read anew when asked: GitHub marks the answer cacheable for a minute.
            cache: 'no-store',
        });
    } catch (error) {
        if (isGitHubGone(error)) {
            return { status: 200, etag: undefined, workflow: await parseWorkflowFile(null) };
        }

        throw error;
    }

    if (answer.status === 304) {
        return { status: 304 };
    }

    const { payload } = answer;
    // A directory answers a list of its entries.
    if (Array.isArray(payload)) {
        return { status: 200, etag: undefined, workflow: await parseWorkflowFile(null) };
    }

    // Past 1 MB GitHub sends no content (`encoding: none`); no workflow file is that large.
    if (!isPlainObject(payload) || typeof payload.content !== 'string' || payload.encoding !== 'base64') {
        throw new GitHubApiError({ status: answer.status, message: 'GitHub workflow file answer is malformed' });
    }

    return {
        status: 200,
        etag: answer.headers.get('etag') ?? undefined,
        workflow: await parseWorkflowFile(decodeBase64Text(payload.content)),
    };
}
