import type { ViewerProject } from '@/repos/RepositoryTypes.js';
import type { ItemProject } from '@/store/ItemTypes.js';

/**
 * The viewer's projects "Add to project" offers for items, given the projects each is in: the open ones not every item
 * is in already.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getAddableProjects(
    projects: readonly ViewerProject[],
    itemProjects: readonly (readonly ItemProject[])[],
): ViewerProject[] {
    return projects.filter(
        project =>
            !project.closed && !itemProjects.every(places => places.some(place => place.projectId === project.id)),
    );
}
