import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import type { PatchStatus } from '../generated.gen.js';
import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import { parsePatchLayout } from '../utils/parsePatchLayout.js';
import type { PatchLayout } from '../utils/parsePatchLayout.js';
import { readNextPageUrl } from '../utils/readNextPageUrl.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** A file a pull request changes, as `GET …/pulls/{n}/files` tells of it. */
export interface PullRequestFile {
    readonly path: string;
    /** Where a renamed or copied file came from, which GraphQL's `PullRequestChangedFile` does not say. */
    readonly previousPath: string | null;
    /** `null` for a status GitHub added after this was written. */
    readonly status: PatchStatus | null;
    readonly additions: number;
    readonly deletions: number;
    /**
     * The shape of its patch; `null` when GitHub left the patch out (a binary file, or a diff too large) or sent one
     * that could not be read.
     */
    readonly layout: PatchLayout | null;
}

/** Which pull request to read. */
export interface ListPullRequestFilesParams {
    /** `owner/name`. */
    nameWithOwner: string;
    number: number;
    /**
     * Told of each page's files as it arrives, before the next is asked for: a pull request of 3,000 files is 30 pages.
     * Throwing stops the read, which then throws that.
     */
    onPage?: (files: readonly PullRequestFile[]) => void;
}

/**
 * Lists the files a pull request changes, `GET /repos/{o}/{r}/pulls/{n}/files` through every page, keeping of each
 * patch only its {@link PatchLayout}. Heavy, as the answer carries the patches.
 *
 * Throws {@link GitHubApiError} when GitHub refuses or an answer is not a list of files.
 */
export async function listPullRequestFiles(
    rest: GitHubRestRequester,
    params: ListPullRequestFilesParams,
): Promise<PullRequestFile[]> {
    const files: PullRequestFile[] = [];
    let next: string | undefined = `${getRepositoryRestPath(params.nameWithOwner)}/pulls/${params.number}/files`;
    let query: Record<string, string> | undefined = { per_page: '100' };
    while (next !== undefined) {
        const page = await rest({ url: next, query });
        if (!Array.isArray(page.payload)) {
            throw malformed(page.status);
        }

        const pageFiles: PullRequestFile[] = [];
        for (const entry of page.payload) {
            if (
                !isPlainObject(entry) ||
                typeof entry.filename !== 'string' ||
                !(entry.previous_filename === undefined || typeof entry.previous_filename === 'string') ||
                typeof entry.status !== 'string' ||
                typeof entry.additions !== 'number' ||
                typeof entry.deletions !== 'number' ||
                !(entry.patch === undefined || typeof entry.patch === 'string')
            ) {
                throw malformed(page.status);
            }

            pageFiles.push({
                path: entry.filename,
                previousPath: entry.previous_filename ?? null,
                status: readStatus(entry.status),
                additions: entry.additions,
                deletions: entry.deletions,
                layout: entry.patch === undefined ? null : parsePatchLayout(entry.patch),
            });
        }

        files.push(...pageFiles);
        params.onPage?.(pageFiles);
        // The URL GitHub hands out already says everything.
        next = readNextPageUrl(page.headers);
        query = undefined;
    }

    return files;
}

/** REST's file statuses in GraphQL's terms, which have no `unchanged`. */
function readStatus(status: string): PatchStatus | null {
    switch (status) {
        case 'added':
            return 'ADDED';
        case 'removed':
            return 'DELETED';
        case 'modified':
        case 'unchanged':
            return 'MODIFIED';
        case 'renamed':
            return 'RENAMED';
        case 'copied':
            return 'COPIED';
        case 'changed':
            return 'CHANGED';
        default:
            return null;
    }
}

function malformed(status: number) {
    return new GitHubApiError({ status, message: 'GitHub pull request files answer is malformed' });
}
