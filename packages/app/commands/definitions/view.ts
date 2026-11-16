import { ArrowDownUp, Columns3, ListChecks, ListFilter, RotateCcw, Rows3, SquareKanban } from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './view.loc.js';

/**
 * How much a list's view options matter in its command menu (commands D14): below what acts on what the list shows (open
 * full screen, a new issue in it), which is what a user opens the menu for, rather than how it shows.
 */
const VIEW_OPTION_PRIORITY = -1;

/** Shows the list as a board, or the board as a list (`ListToolbar`); its binding names the way it goes. */
export const toggleLayout = defineAppCommand({
    id: 'toggleLayout',
    title: l.toggleLayout,
    icon: Columns3,
    key: 'Shift+V',
    places: ['list'],
    priority: VIEW_OPTION_PRIORITY,
});

/** What the list's rows are grouped by: a submenu of the groupings. */
export const groupBy = defineAppCommand({
    id: 'groupBy',
    title: l.groupBy,
    icon: Rows3,
    places: ['list'],
    priority: VIEW_OPTION_PRIORITY,
});

/** The order of the list's rows: a submenu of the orders. */
export const orderBy = defineAppCommand({
    id: 'orderBy',
    title: l.orderBy,
    icon: ArrowDownUp,
    places: ['list'],
    priority: VIEW_OPTION_PRIORITY,
});

/** The state of what a repository's section lists (open, closed, both): its toolbar's filter. */
export const filterByState = defineAppCommand({
    id: 'filterByState',
    title: l.filterByState,
    icon: ListFilter,
    places: ['list'],
    priority: VIEW_OPTION_PRIORITY,
});

/** The field a project shows next to its items in other lists. */
export const rowField = defineAppCommand({
    id: 'rowField',
    title: l.rowField,
    icon: SquareKanban,
    places: ['list'],
    priority: VIEW_OPTION_PRIORITY,
});

/** The properties the list's rows show: several, each toggled with the menu staying open. */
export const showProperties = defineAppCommand({
    id: 'showProperties',
    title: l.showProperties,
    icon: ListChecks,
    places: ['list'],
    priority: VIEW_OPTION_PRIORITY,
});

/** The list's view options back to its defaults, offered while they differ. */
export const resetView = defineAppCommand({
    id: 'resetView',
    title: l.resetView,
    icon: RotateCcw,
    places: ['list'],
    priority: VIEW_OPTION_PRIORITY,
});
