import type { GitHubSdk } from '../createGitHubRequester.js';
import type { RepositoryWorkflowFilesQuery } from '../generated.gen.js';
import { GitHubApiError } from '../GitHubApiError.js';
import { parseWorkflowFile } from './parseWorkflowFile.js';
import type { GitHubWorkflowFileParse } from './parseWorkflowFile.js';

/** Whose workflow files to read, at which ref. */
export interface ReadRepositoryWorkflowFilesParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    /** A branch, tag or commit; the default branch when absent. */
    readonly ref?: string;
}

/**
 * Reads and parses every workflow file of a repository at a ref in one request (`RepositoryWorkflowFiles`), by path
 * (`.github/workflows/ci.yml`) — what a workflow's `path` gives. Only `.yml` and `.yaml` files count, as for GitHub.
 * No `.github/workflows` there answers none. A file GitHub cuts off (near 512 KB; no workflow file is that large) is
 * left out. Not conditional: GraphQL has no ETag.
 *
 * Throws {@link GitHubApiError} when GitHub refuses, or has no such repository.
 */
export async function readRepositoryWorkflowFiles(
    sdk: GitHubSdk,
    { nameWithOwner, ref }: ReadRepositoryWorkflowFilesParams,
): Promise<Map<string, GitHubWorkflowFileParse>> {
    const [owner = '', name = ''] = nameWithOwner.split('/');
    const { repository }: RepositoryWorkflowFilesQuery = await sdk.RepositoryWorkflowFiles({
        owner,
        name,
        expression: `${ref ?? 'HEAD'}:.github/workflows`,
    });
    if (!repository) {
        throw new GitHubApiError({ status: 404, message: `GitHub has no repository ${nameWithOwner}` });
    }

    const files = new Map<string, GitHubWorkflowFileParse>();
    const tree = repository.object;
    if (!tree || !('entries' in tree)) {
        return files;
    }

    for (const entry of tree.entries ?? []) {
        const blob = entry.object;
        if (
            entry.path === null ||
            !/\.ya?ml$/u.test(entry.path) ||
            !blob ||
            !('text' in blob) ||
            blob.isTruncated ||
            blob.text === null
        ) {
            continue;
        }

        files.set(entry.path, await parseWorkflowFile(blob.text));
    }

    return files;
}
