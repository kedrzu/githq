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
