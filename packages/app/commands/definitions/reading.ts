import { ArrowLeft, FoldVertical } from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './reading.loc.js';

/** Closes find once the keys left its field (whose own Escape closes it too); the marks go, the query stays. */
export const closeFind = defineAppCommand({
    id: 'closeFind',
    title: l.closeFind,
    key: 'Escape',
    places: ['review', 'jobLog'],
    configurable: false,
});

/**
 * Folds what the cursor is in to its header, or unfolds it: a review's file, a job log's step (among only a search's
 * matches, it opens the gap the cursor is on). The binding names which way it goes and gives its icon.
 */
export const fold = defineAppCommand({
    id: 'fold',
    title: l.fold,
    icon: FoldVertical,
    key: 'Space',
    places: ['review', 'jobLog'],
});

/**
 * Leaves the screen for the one it was entered from (a review for its pull request, a workflow's run for its workflow or
 * list), once nothing on it is left to close by Escape first; the binding names where it goes.
 */
export const back = defineAppCommand({
    id: 'back',
    title: l.back,
    icon: ArrowLeft,
    key: 'Escape',
    places: ['review', 'workflowRun'],
    configurable: false,
});
