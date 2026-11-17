import { Search } from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './jobLog.loc.js';

/**
 * Opens the search of a job's whole log (actions W4b), or puts the cursor back in its field. `⌘F` too: the browser's
 * own find can't see the lines not drawn. The search's field selects what is typed by that key (`WorkflowLogSearch`).
 */
export const searchLog = defineAppCommand({
    id: 'searchLog',
    title: l.searchLog,
    icon: Search,
    key: '/',
    otherKeys: ['Mod+F'],
    places: ['jobLog'],
});

/**
 * To the next match of the log's search, wrapping around. Not `findNext`'s other key: `N` is a review's next thread,
 * which a user may move.
 */
export const nextMatch = defineAppCommand({
    id: 'nextMatch',
    title: l.nextMatch,
    key: 'N',
    places: ['jobLog'],
});

/** To the previous match of the log's search, wrapping around; as {@link nextMatch}. */
export const previousMatch = defineAppCommand({
    id: 'previousMatch',
    title: l.previousMatch,
    key: 'Shift+N',
    places: ['jobLog'],
});

/**
 * Enter while the log's search has matches: the next one, or — among only the matches — the line in the full log. Its
 * binding names which.
 */
export const enterMatch = defineAppCommand({
    id: 'enterMatch',
    title: l.enterMatch,
    key: 'Enter',
    places: ['jobLog'],
    configurable: false,
});

/** Shows only the lines the log's search matches, or the full log again (W4c). */
export const onlyMatches = defineAppCommand({
    id: 'onlyMatches',
    title: l.onlyMatches,
    key: 'Tab',
    places: ['jobLog'],
    configurable: false,
});

/** The log's cursor to the next step's first line. */
export const nextStep = defineAppCommand({
    id: 'nextStep',
    title: l.nextStep,
    key: 'Shift+J',
    places: ['jobLog'],
});

/** The log's cursor to the previous step's first line. */
export const previousStep = defineAppCommand({
    id: 'previousStep',
    title: l.previousStep,
    key: 'Shift+K',
    places: ['jobLog'],
});

/** The log's cursor to the next error marker. */
export const nextError = defineAppCommand({
    id: 'nextError',
    title: l.nextError,
    key: 'E',
    places: ['jobLog'],
});

/** The log's cursor to the previous error marker. */
export const previousError = defineAppCommand({
    id: 'previousError',
    title: l.previousError,
    key: 'Shift+E',
    places: ['jobLog'],
});

/** The log's cursor to its first line, the view to its top. */
export const logTop = defineAppCommand({
    id: 'logTop',
    title: l.logTop,
    key: 'G',
    places: ['jobLog'],
});

/** The log's cursor to its last line, the view to its end. */
export const logEnd = defineAppCommand({
    id: 'logEnd',
    title: l.logEnd,
    key: 'Shift+G',
    places: ['jobLog'],
});

/** The log's cursor and view half a page down. */
export const halfPageDown = defineAppCommand({
    id: 'halfPageDown',
    title: l.halfPageDown,
    key: 'D',
    places: ['jobLog'],
});

/** The log's cursor and view half a page up. */
export const halfPageUp = defineAppCommand({
    id: 'halfPageUp',
    title: l.halfPageUp,
    key: 'U',
    places: ['jobLog'],
});

/** Shows the cursor's line past the cut ("… N more characters"), while no search has matches: Enter is theirs then. */
export const showWholeLine = defineAppCommand({
    id: 'showWholeLine',
    title: l.showWholeLine,
    key: 'Enter',
    places: ['jobLog'],
    configurable: false,
});

/** Copies the link to the cursor's line, in GitHub's form (`#step:2:3`). */
export const copyLineLink = defineAppCommand({
    id: 'copyLineLink',
    title: l.copyLineLink,
    key: 'Y',
    places: ['jobLog'],
});

/** Wraps a log's long lines, or lays them out on one line each; kept on this device. */
export const wrapLines = defineAppCommand({
    id: 'wrapLines',
    title: l.wrapLines,
    key: 'W',
    places: ['jobLog'],
});

/** Shows the time beside each line of a log, or hides it; kept on this device. */
export const showTimes = defineAppCommand({
    id: 'showTimes',
    title: l.showTimes,
    key: 'T',
    places: ['jobLog'],
});
