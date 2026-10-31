import type { EditPermissions } from '@/edits/getEditPermissions.js';
import type { RepositoryMetadata, ViewerProject } from '@/repos/RepositoryTypes.js';

/** What the item view offers to edit, and what its pickers offer (D14: nothing the user may not do). */
export interface ItemEditing {
    readonly permissions: EditPermissions;
    /** The repository's labels, users, milestones and types; `null` while being read. */
    readonly metadata: RepositoryMetadata | null;
    /** The signed-in user: "assign to me" comes first. */
    readonly viewerLogin: string;
    /** The projects the item can be added to; `null` until read. */
    readonly viewerProjects: readonly ViewerProject[] | null;
}
