import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './commits.loc.js';

/** Puts the cursor in the filter of the commit graph's branches and tags, opening their list when it is folded away. */
export const findRef = defineAppCommand({
    id: 'findRef',
    title: l.findRef,
    key: 'B',
    places: ['commits'],
});

/** Closes the list of branches and tags lying over the commit graph (a window too narrow to keep it beside). */
export const closeRefList = defineAppCommand({
    id: 'closeRefList',
    title: l.closeRefList,
    key: 'Escape',
    places: ['commits'],
    configurable: false,
});

/** Opens the opened commit's first parent in its place, replacing the address. */
export const firstParent = defineAppCommand({
    id: 'firstParent',
    title: l.firstParent,
    key: 'P',
    places: ['commit'],
});

/** Opens the opened commit's second parent (a merge's) in its place, replacing the address. */
export const secondParent = defineAppCommand({
    id: 'secondParent',
    title: l.secondParent,
    key: 'Shift+P',
    places: ['commit'],
});

/**
 * Opens the opened commit's pull request in its place, as any item opens, by its address (a fork's commit answers with
 * its upstream's). `⇧O`, an "open" key free in a commit and the commit graph beside it: `⇧Enter` opens full screen there
 * as everywhere (`openFullScreen`), and the item's `⇧O` (Open files) is never on screen with a commit.
 */
export const openCommitPullRequest = defineAppCommand({
    id: 'openCommitPullRequest',
    title: l.openCommitPullRequest,
    key: 'Shift+O',
    places: ['commit'],
});
