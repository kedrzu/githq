import type { RouteLocationRaw } from 'vue-router';

import { getProjectPath } from '@/tracking/trackingRoutes.js';

import { compileProjectFilter } from './filter/compileProjectFilter.js';
import type { CompileProjectFilterParams } from './filter/compileProjectFilter.js';
import type { Project } from './ProjectTypes.js';
import type { ProjectTab } from './ProjectView.vue';
import { ALL_ITEMS_LIST, getProjectViewListKey } from './projectViewOptions.js';

/** What a saved filter is compiled with besides its text and the project's fields: the viewer, the day, the drafts. */
export type ProjectFilterContext = Omit<CompileProjectFilterParams, 'fields' | 'filter'>;

/** How the tab shown stands now, as the page showing it knows: its options and filter as changed there. */
export interface ProjectShownTabState {
    readonly modified: boolean;
    readonly answered: boolean;
}

/** "All items" (K9) as its tab shows it, while it is the one shown. */
export interface ProjectAllItemsTab {
    readonly name: string;
    readonly to: RouteLocationRaw;
}

/** What {@link getProjectViewTabs} lists. */
export interface GetProjectViewTabsParams {
    readonly project: Project;
    /** The tab shown: a saved view's id, {@link ALL_ITEMS_LIST} for "All items", `null` for none. */
    readonly shownKey: string | null;
    /** How the tab shown stands now; without it, it reads as the others, by what this device keeps of it. */
    readonly shownState?: ProjectShownTabState;
    readonly allItems: ProjectAllItemsTab;
    /** Whether this device keeps changed options under a list (`ListViewOptionsStore.has`). */
    readonly isKept: (list: string) => boolean;
    readonly filterContext: ProjectFilterContext;
}

/**
 * A project's saved views as its tabs and its rows in the sidebar show them — "All items" after them only while it is
 * shown: each with its address, whether this device changed its options (D13) and whether GitHub answers its filter
 * (K6), by its saved filter; the tab shown by `shownState` when given.
 * @__NO_SIDE_EFFECTS__
 */
export function getProjectViewTabs(params: GetProjectViewTabsParams): ProjectTab[] {
    const { project, shownKey, shownState, allItems, isKept, filterContext } = params;
    const saved = project.views.map((view): ProjectTab => {
        const shown = view.id === shownKey;
        const live = shown ? shownState : undefined;
        return {
            key: view.id,
            name: view.name,
            to: getProjectPath(project, view.number),
            current: shown,
            modified: live?.modified ?? isKept(getProjectViewListKey(project.id, view.id)),
            answered: live?.answered ?? isAnswered(view.filter),
        };
    });
    if (shownKey !== ALL_ITEMS_LIST) {
        return saved;
    }

    const all: ProjectTab = {
        key: ALL_ITEMS_LIST,
        name: allItems.name,
        to: allItems.to,
        current: true,
        modified: shownState?.modified ?? isKept(getProjectViewListKey(project.id, ALL_ITEMS_LIST)),
        answered: false,
    };
    return [...saved, all];

    function isAnswered(filter: string | null) {
        return (
            compileProjectFilter({ ...filterContext, filter: filter || null, fields: project.fields }).kind === 'github'
        );
    }
}
