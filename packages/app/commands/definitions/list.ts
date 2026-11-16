import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './list.loc.js';

/** Moves the cursor of what is listed one step down: a list's rows (on the board within the column). */
export const next = defineAppCommand({
    id: 'next',
    title: l.next,
    key: 'J',
    otherKeys: ['ArrowDown'],
    places: ['list'],
});

/** Moves the cursor of what is listed one step up. */
export const previous = defineAppCommand({
    id: 'previous',
    title: l.previous,
    key: 'K',
    otherKeys: ['ArrowUp'],
    places: ['list'],
});

/** Opens what the cursor is on: a list's row beside the list, or — on the opened one's row — on its page. */
export const open = defineAppCommand({
    id: 'open',
    title: l.open,
    key: 'Enter',
    places: ['list'],
    configurable: false,
});

/** Adds the selected row to the items edited together, or takes it out. */
export const check = defineAppCommand({
    id: 'check',
    title: l.check,
    key: 'X',
    places: ['list'],
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

/** Empties the items edited together (on a phone, leaves selecting them). */
export const uncheck = defineAppCommand({
    id: 'uncheck',
    title: l.uncheck,
    key: 'Escape',
    places: ['list'],
    configurable: false,
});

/** On the board: to the card at the same height in the next column that has any. */
export const nextColumn = defineAppCommand({
    id: 'nextColumn',
    title: l.nextColumn,
    key: 'ArrowRight',
    places: ['board'],
    configurable: false,
});

/** On the board: to the card at the same height in the previous column that has any. */
export const previousColumn = defineAppCommand({
    id: 'previousColumn',
    title: l.previousColumn,
    key: 'ArrowLeft',
    places: ['board'],
    configurable: false,
});

/** On the board: the selected card into the next column that takes it. */
export const moveToNextColumn = defineAppCommand({
    id: 'moveToNextColumn',
    title: l.moveToNextColumn,
    key: 'Shift+ArrowRight',
    places: ['board'],
    configurable: false,
});

/** On the board: the selected card into the previous column that takes it. */
export const moveToPreviousColumn = defineAppCommand({
    id: 'moveToPreviousColumn',
    title: l.moveToPreviousColumn,
    key: 'Shift+ArrowLeft',
    places: ['board'],
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
    places: ['board'],
    configurable: false,
});
