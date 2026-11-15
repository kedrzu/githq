import { hasRole } from '@/edits/getEditPermissions.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';

/**
 * Why the user can't run any workflow of a repository by hand, as with every edit githq knows they can't make: a role
 * below write, or not known yet, or an archived repository; `null` when they may.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositoryDispatchBlock(
    metadata: Pick<RepositoryMetadata, 'isArchived' | 'viewerPermission'> | undefined,
): 'noAccess' | 'archived' | null {
    if (!hasRole(metadata?.viewerPermission, 'WRITE')) {
        return 'noAccess';
    }

    return metadata?.isArchived ? 'archived' : null;
}
