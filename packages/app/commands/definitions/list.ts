import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './list.loc.js';

/**
 * The places whose rows the cursor keys move through and open: a list (on the board within the column), the commit
 * graph, a repository's Workflows section, the broken workflows, an opened workflow's runs, a repository's workflow
 * alerts and the tracked repositories or projects (`useRowSelection`).
 */
const ROW_PLACES = [
    'list',
    'commits',
    'workflows',
    'brokenWorkflows',
    'workflow',
    'workflowAlerts',
    'trackedList',
] as const;

/**
 * Moves the cursor of what is listed one step down; an opened item, or a commit on its page, to the next of the list it
 * was opened from (`useItemKeys`); a review to the next pull request of that list.
 */
export const next = defineAppCommand({
    id: 'next',
    title: l.next,
    key: 'J',
    otherKeys: ['ArrowDown'],
    places: [...ROW_PLACES, 'item', 'commit', 'review'],
});

/**
 * Moves the cursor of what is listed one step up; an opened item, or a commit on its page, to the previous one; a review
 * to the previous pull request.
 */
export const previous = defineAppCommand({
    id: 'previous',
    title: l.previous,
    key: 'K',
    otherKeys: ['ArrowUp'],
    places: [...ROW_PLACES, 'item', 'commit', 'review'],
});

/**
 * Opens what the cursor is on: a list's row beside the list, or — on the opened one's row — on its page; a commit, a
 * workflow, a run, a tracked repository's settings; edits an alert pattern in place. A row's context menu offers it as
 * the item's (`item`), the key staying the list's.
 */
export const open = defineAppCommand({
    id: 'open',
    title: l.open,
    key: 'Enter',
    places: [...ROW_PLACES, 'item'],
    configurable: false,
});

/** Adds the selected row to the items edited together, or takes it out; in a review, the current file to those selected. */
export const check = defineAppCommand({
    id: 'check',
    title: l.check,
    key: 'X',
    places: ['list', 'review'],
});

/** Adds the selected row and the next one to the items edited together, and moves there. */
export const checkNext = defineAppCommand({
    id: 'checkNext',
    title: l.checkNext,
    key: 'Shift+J',
    otherKeys: ['Shift+ArrowDown'],
    places: ['list'],
});

/** Adds the selected row and the previous one to the items edited together, and moves there. */
export const checkPrevious = defineAppCommand({
    id: 'checkPrevious',
    title: l.checkPrevious,
    key: 'Shift+K',
    otherKeys: ['Shift+ArrowUp'],
    places: ['list'],
});

/** Empties the items edited together (on a phone, leaves selecting them), or a review's files selected. */
export const uncheck = defineAppCommand({
    id: 'uncheck',
    title: l.uncheck,
    key: 'Escape',
    places: ['list', 'review'],
    configurable: false,
});

/** On the board: to the card at the same height in the next column that has any. */
export const nextColumn = defineAppCommand({
    id: 'nextColumn',
    title: l.nextColumn,
    key: 'ArrowRight',
    places: ['list'],
    configurable: false,
});

/** On the board: to the card at the same height in the previous column that has any. */
export const previousColumn = defineAppCommand({
    id: 'previousColumn',
    title: l.previousColumn,
    key: 'ArrowLeft',
    places: ['list'],
    configurable: false,
});

/** On the board: the selected card into the next column that takes it. */
export const moveToNextColumn = defineAppCommand({
    id: 'moveToNextColumn',
    title: l.moveToNextColumn,
    key: 'Shift+ArrowRight',
    places: ['list'],
    configurable: false,
});

/** On the board: the selected card into the previous column that takes it. */
export const moveToPreviousColumn = defineAppCommand({
    id: 'moveToPreviousColumn',
    title: l.moveToPreviousColumn,
    key: 'Shift+ArrowLeft',
    places: ['list'],
    configurable: false,
});

/** In the list layout: expands the selected stack's entry or header. */
export const expandStack = defineAppCommand({
    id: 'expandStack',
    title: l.expandStack,
    key: 'ArrowRight',
    places: ['list'],
    configurable: false,
});

/** In the list layout: collapses the selected stack's entry or header — on one of its rows, selecting the entry. */
export const collapseStack = defineAppCommand({
    id: 'collapseStack',
    title: l.collapseStack,
    key: 'ArrowLeft',
    places: ['list'],
    configurable: false,
});

/** On the board, where ←/→ step between columns: expands or collapses the selected stack's card. */
export const toggleStackCard = defineAppCommand({
    id: 'toggleStackCard',
    title: l.toggleStack,
    key: 'Space',
    places: ['list'],
    configurable: false,
});

/**
 * Adds an entry to the list on screen: repositories or projects to track, a branch or tag pattern raising workflow
 * alerts. One command (commands D1): whoever moves "add" off `A` moves it for every list of settings.
 */
export const add = defineAppCommand({
    id: 'add',
    title: l.add,
    key: 'A',
    places: ['trackedList', 'workflowAlerts'],
});

/**
 * Removes the selected entry of the list on screen at once: untracks a repository or project, removes an alert pattern.
 * One command (commands D1), as Backspace deletes what is selected wherever it is.
 */
export const remove = defineAppCommand({
    id: 'remove',
    title: l.remove,
    key: 'Backspace',
    places: ['trackedList', 'workflowAlerts'],
    configurable: false,
});

/** Switches the selected row's switch, as Space on the switch itself does (the default branch's workflow alerts). */
export const toggleRow = defineAppCommand({
    id: 'toggleRow',
    title: l.toggleRow,
    key: 'Space',
    places: ['workflowAlerts'],
    configurable: false,
});
