import { ArrowDown, ArrowLeft, ArrowUp, FoldVertical, Search } from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './reading.loc.js';

/**
 * Opens find over what is read (a review's diff, a job's whole log), or puts the cursor back in its field, what is typed
 * selected. Not in a field, which keeps `⌘F` (`ReviewView`'s and `WorkflowJobLog`'s bindings).
 */
export const find = defineAppCommand({
    id: 'find',
    title: l.find,
    icon: Search,
    key: 'Mod+F',
    places: ['review', 'jobLog'],
});

/** To the next match of what find looks for, wrapping around; the find field's own Enter does the same. */
export const findNext = defineAppCommand({
    id: 'findNext',
    title: l.findNext,
    icon: ArrowDown,
    key: 'Mod+G',
    otherKeys: ['F3'],
    places: ['review'],
});

/** To the previous match of what find looks for, wrapping around; as {@link findNext}. */
export const findPrevious = defineAppCommand({
    id: 'findPrevious',
    title: l.findPrevious,
    icon: ArrowUp,
    key: 'Shift+Mod+G',
    otherKeys: ['Shift+F3'],
    places: ['review'],
});

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
