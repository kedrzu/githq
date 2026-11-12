import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import { parsePatchLayout } from '../utils/parsePatchLayout.js';
import type { PatchLayout } from '../utils/parsePatchLayout.js';
import { parseSubmodulePatch } from '../utils/parseSubmodulePatch.js';
import type { SubmodulePointers } from '../utils/parseSubmodulePatch.js';
import { readLastPageNumber } from '../utils/readLastPageNumber.js';
import { readNextPageUrl } from '../utils/readNextPageUrl.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** A file a pull request changes, as `GET …/pulls/{n}/files` tells of it. */
export interface PullRequestFile {
    readonly path: string;
    /** Where a renamed or copied file came from, which GraphQL's `PullRequestChangedFile` does not say. */
    readonly previousPath: string | null;
    readonly additions: number;
    readonly deletions: number;
    /**
     * The shape of its patch; `null` when GitHub left the patch out (a binary file, or a diff too large) or sent one
     * that could not be read.
     */
    readonly layout: PatchLayout | null;
    /** The commits a submodule pointed at, when the patch only moves, adds or removes one; `null` for anything else. */
    readonly submodule: SubmodulePointers | null;
}

/** A page of a pull request's files, and how far into the list it is. */
export interface PullRequestFilesPage {
    readonly files: readonly PullRequestFile[];
    /** 1-based. */
    readonly number: number;
    /** How many pages there are, as GitHub's `Link` header says; `null` when it does not. */
    readonly pages: number | null;
}

/** Which pull request to read. */
export interface ListPullRequestFilesParams {
    /** `owner/name`. */
    nameWithOwner: string;
    number: number;
    /**
     * Told of each page as it arrives, before the next is asked for: a pull request of 3,000 files is 30 pages. Throwing
     * stops the read, which then throws that.
     */
    onPage: (page: PullRequestFilesPage) => void;
}

/**
 * Reads the files a pull request changes, `GET /repos/{o}/{r}/pulls/{n}/files` through every page, keeping of each
 * patch only its {@link PatchLayout}, and hands them over page by page. Heavy, as the answer carries the patches.
 *
 * Throws {@link GitHubApiError} when GitHub refuses or an answer is not a list of files.
 */
export async function listPullRequestFiles(
    rest: GitHubRestRequester,
    params: ListPullRequestFilesParams,
): Promise<void> {
    let number = 0;
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
                typeof entry.additions !== 'number' ||
                typeof entry.deletions !== 'number' ||
                !(entry.patch === undefined || typeof entry.patch === 'string')
            ) {
                throw malformed(page.status);
            }

            pageFiles.push({
                path: entry.filename,
                previousPath: entry.previous_filename ?? null,
                additions: entry.additions,
                deletions: entry.deletions,
                layout: entry.patch === undefined ? null : parsePatchLayout(entry.patch),
                submodule: entry.patch === undefined ? null : parseSubmodulePatch(entry.patch),
            });
        }

        number++;
        // The URL GitHub hands out already says everything.
        next = readNextPageUrl(page.headers);
        query = undefined;
        params.onPage({
            files: pageFiles,
            number,
            pages: readLastPageNumber(page.headers) ?? (next === undefined ? number : null),
        });
    }
}

function malformed(status: number) {
    return new GitHubApiError({ status, message: 'GitHub pull request files answer is malformed' });
}
