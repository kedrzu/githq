import type { GitHubSdk } from './createGitHubRequester.js';
import type { RepositoryReleasesQuery } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';

/** A repository on GitHub. */
export interface ListReleasesParams {
    readonly owner: string;
    readonly name: string;
}

/** A published version of a repository, as GitHub rendered its description. */
export interface GitHubRelease {
    /** `v0.2.0`. */
    readonly tagName: string;
    /** ISO. */
    readonly publishedAt: string;
    /** The description as HTML GitHub rendered and sanitized; empty for a release with none. */
    readonly bodyHtml: string;
    /** The commit its tag points at; `null` when the tag is gone. */
    readonly tagCommit: string | null;
}

/**
 * Lists a repository's stable releases (`RepositoryReleases`), every page: neither drafts, which only those with push
 * access get, nor prereleases. Their order is the caller's to set.
 *
 * Throws {@link GitHubApiError} when GitHub refuses, or has no such repository.
 */
export async function listReleases(sdk: GitHubSdk, { owner, name }: ListReleasesParams): Promise<GitHubRelease[]> {
    const releases: GitHubRelease[] = [];
    let after: string | null = null;

    do {
        const { repository }: RepositoryReleasesQuery = await sdk.RepositoryReleases({ owner, name, after });
        if (!repository) {
            throw new GitHubApiError({ status: 404, message: `GitHub has no repository ${owner}/${name}` });
        }

        const { nodes, pageInfo } = repository.releases;
        for (const release of nodes ?? []) {
            if (release && !release.isDraft && !release.isPrerelease && release.publishedAt !== null) {
                releases.push({
                    tagName: release.tagName,
                    publishedAt: release.publishedAt,
                    bodyHtml: release.descriptionHTML ?? '',
                    tagCommit: release.tagCommit?.oid ?? null,
                });
            }
        }

        after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
    } while (after !== null);

    return releases;
}
