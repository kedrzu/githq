import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';

/** The address segment of each "my work" group's own list, `/my/<segment>`. */
const SEGMENTS: Readonly<Record<MyWorkGroup, string>> = {
    reviewRequested: 'review-requested',
    authored: 'pull-requests',
    assigned: 'assigned',
    mentioned: 'mentioned',
};

/** The route path of "my work" narrowed to one group; the router accepts only these segments. */
export const MY_WORK_GROUP_PATH = `/my/:group(${Object.values(SEGMENTS).join('|')})`;

/**
 * The address of "my work" narrowed to `group`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getMyWorkGroupPath(group: MyWorkGroup) {
    return `/my/${SEGMENTS[group]}`;
}

/**
 * The group a `/my/<segment>` address names, or `null`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function parseMyWorkGroupSegment(segment: unknown): MyWorkGroup | null {
    for (const group of MY_WORK_GROUPS) {
        if (SEGMENTS[group] === segment) {
            return group;
        }
    }

    return null;
}
