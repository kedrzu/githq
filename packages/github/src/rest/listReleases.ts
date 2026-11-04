import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import { readNextPageUrl } from '../utils/readNextPageUrl.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** A published version of a repository, as GitHub rendered its description. */
export interface GitHubRelease {
    /** `v0.2.0`. */
    readonly tagName: string;
    /** ISO. */
    readonly publishedAt: string;
    /** The description as HTML GitHub rendered and sanitized; empty for a release with none. */
    readonly bodyHtml: string;
}

const PAGE_SIZE = 100;

/**
 * Lists a repository's stable releases (`GET /repos/{o}/{r}/releases`), every page: neither drafts, which only those
 * with push access get, nor prereleases. GitHub doesn't state their order, so it is the caller's to set.
 *
 * Throws {@link GitHubApiError} when GitHub refuses, or the answer is not a list of releases.
 */
export async function listReleases(rest: GitHubRestRequester, nameWithOwner: string): Promise<GitHubRelease[]> {
    const releases: GitHubRelease[] = [];
    let url: string | undefined = `${getRepositoryRestPath(nameWithOwner)}/releases`;
    let query: Record<string, string> | undefined = { per_page: String(PAGE_SIZE) };

    while (url !== undefined) {
        const answer = await rest({ url, query, accept: 'application/vnd.github.html+json' });
        if (!Array.isArray(answer.payload)) {
            throw malformed(answer.status);
        }

        for (const entry of answer.payload) {
            if (!isPlainObject(entry) || typeof entry.tag_name !== 'string') {
                throw malformed(answer.status);
            }

            if (entry.draft !== true && entry.prerelease !== true && typeof entry.published_at === 'string') {
                releases.push({
                    tagName: entry.tag_name,
                    publishedAt: entry.published_at,
                    bodyHtml: typeof entry.body_html === 'string' ? entry.body_html : '',
                });
            }
        }

        url = readNextPageUrl(answer.headers);
        query = undefined;
    }

    return releases;
}

function malformed(status: number) {
    return new GitHubApiError({ status, message: 'GitHub release list answer is malformed' });
}
