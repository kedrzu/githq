import { ChevronLeft, ChevronRight, Eye, ListFilter } from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './tabs.loc.js';

/**
 * Goes to a repository's section by its position among the tabs (`1` Issues … `4` Workflows; commands D9): the number
 * stays its own while Workflows is not shown. The binding names the section and gives its icon.
 */
export const goToSection = defineAppCommand({
    id: 'goToSection',
    title: l.goToSection,
    numbers: { first: 1, last: 4 },
    places: ['repository'],
});

/**
 * Goes to a project's n-th saved view (commands D9), the first nine on their numbers; the binding names the view and
 * offers the later ones in the menus with no key. "All items" is no saved view and has no number.
 */
export const goToView = defineAppCommand({
    id: 'goToView',
    title: l.goToView,
    icon: Eye,
    numbers: { first: 1, last: 9 },
    places: ['project'],
});

/**
 * Shows My work's n-th filter (All, Needs me, Waiting on others; commands D9); the binding names it. Of `list`, the
 * place of My work's other keys (`ListView`), so a list key on a digit would conflict with it.
 */
export const showFilter = defineAppCommand({
    id: 'showFilter',
    title: l.showFilter,
    icon: ListFilter,
    numbers: { first: 1, last: 3 },
    places: ['list'],
});

/**
 * Steps to the tab before the one shown, wrapping around: a repository's sections, a project's saved views. One command
 * for both, so rebinding moves both; a symbol, not a control's own key (D4), so it can be rebound. The binding names
 * what it steps through ("Previous section"); keys and the help sheet only, as in ⌘K it would stand between the tabs.
 */
export const previousTab = defineAppCommand({
    id: 'previousTab',
    title: l.previousTab,
    icon: ChevronLeft,
    key: '[',
    places: ['repository', 'project'],
});

/** Steps to the tab after the one shown, wrapping around; as {@link previousTab}. */
export const nextTab = defineAppCommand({
    id: 'nextTab',
    title: l.nextTab,
    icon: ChevronRight,
    key: ']',
    places: ['repository', 'project'],
});
