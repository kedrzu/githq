import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';

/**
 * The address of each "my work" group's own list: GitHub's dashboard list of the same work, so the address opens
 * the matching list on github.com too.
 */
export const MY_WORK_GROUP_PATHS: Readonly<Record<MyWorkGroup, string>> = {
    reviewRequested: '/pulls/review-requested',
    authored: '/pulls',
    assigned: '/issues/assigned',
    mentioned: '/issues/mentioned',
};

/**
 * The address of the pull requests with the viewer's draft review (code review D28). The one list here GitHub has no
 * address for, under its dashboard's so that it reads as one of them; nothing else in GitHub's `/pulls/` uses it.
 */
export const DRAFT_REVIEWS_PATH = '/pulls/drafts';

declare module 'vue-router' {
    interface RouteMeta {
        /** The "my work" group the route narrows the page to (`MY_WORK_GROUP_PATHS`). */
        myWorkGroup?: MyWorkGroup;
    }
}

/**
 * The address of "my work" narrowed to `group`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getMyWorkGroupPath(group: MyWorkGroup) {
    return MY_WORK_GROUP_PATHS[group];
}
