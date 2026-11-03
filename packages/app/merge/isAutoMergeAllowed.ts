import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';

/**
 * Auto-merge may be turned on here, as far as is known: the repository allows it and the viewer's read, once there,
 * doesn't say otherwise. A pull request in a stack is told apart by the verdict (`usePullRequestVerdict`).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isAutoMergeAllowed(
    settings: Pick<RepositoryMetadata, 'autoMergeAllowed'> | null | undefined,
    viewerCanEnableAutoMerge: boolean | null | undefined,
) {
    return settings?.autoMergeAllowed === true && viewerCanEnableAutoMerge !== false;
}
