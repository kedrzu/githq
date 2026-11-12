import type { GitHubSdk } from './createGitHubRequester.js';
import type { CommitSubmodulesQuery } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';

/** A submodule a commit declares in its `.gitmodules`. */
export interface CommitSubmodule {
    /** Where it sits in the repository. */
    readonly path: string;
    /** Its repository, as `.gitmodules` gives it: an `https://`, `git@` or relative URL. */
    readonly gitUrl: string;
}

/** Whose submodules to read. */
export interface ReadCommitSubmodulesParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly oid: string;
}

/**
 * Reads the submodules a commit declares (`CommitSubmodules`), the first 100.
 *
 * Throws {@link GitHubApiError} when GitHub refuses, or has no such commit.
 */
export async function readCommitSubmodules(
    sdk: GitHubSdk,
    { nameWithOwner, oid }: ReadCommitSubmodulesParams,
): Promise<CommitSubmodule[]> {
    const [owner = '', name = ''] = nameWithOwner.split('/');
    const { repository }: CommitSubmodulesQuery = await sdk.CommitSubmodules({ owner, name, oid });
    const commit = repository?.object;
    if (!commit || !('submodules' in commit)) {
        throw new GitHubApiError({ status: 404, message: `GitHub has no commit ${oid} in ${nameWithOwner}` });
    }

    const submodules: CommitSubmodule[] = [];
    for (const node of commit.submodules.nodes ?? []) {
        if (node) {
            submodules.push(node);
        }
    }

    return submodules;
}
