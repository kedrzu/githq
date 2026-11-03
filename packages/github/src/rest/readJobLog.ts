import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import { isGitHubGone } from '../utils/isGitHubGone.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** Which job's log to read. */
export interface ReadJobLogParams {
    /** `owner/name`. */
    nameWithOwner: string;
    jobId: number;
}

/** The log as GitHub wrote it, or GitHub no longer has it. */
export type ReadJobLogResult = { status: 200; text: string } | { status: 'gone' };

/**
 * Reads a job's log (`GET /repos/{o}/{r}/actions/jobs/{id}/logs`), plain text: GitHub answers with a redirect to a blob
 * valid for a minute, which `fetch` follows (actions D3), so it is read anew each time. Only a refusal reports an
 * allowance: the blob's answer carries none. Kept out of the browser's HTTP cache: nothing is gained by it with a URL
 * signed anew each time, and a private repository's log would stay there after signing out.
 *
 * Throws {@link GitHubApiError} when GitHub refuses other than with "gone", or answers without a log.
 */
export async function readJobLog(rest: GitHubRestRequester, params: ReadJobLogParams): Promise<ReadJobLogResult> {
    const { nameWithOwner, jobId } = params;
    try {
        const answer = await rest({
            url: `${getRepositoryRestPath(nameWithOwner)}/actions/jobs/${jobId}/logs`,
            cache: 'no-store',
        });
        if (answer.status !== 200) {
            throw new GitHubApiError({ status: answer.status, message: 'GitHub job log answer is malformed' });
        }

        return { status: 200, text: answer.text };
    } catch (error) {
        if (isGitHubGone(error)) {
            return { status: 'gone' };
        }

        throw error;
    }
}
