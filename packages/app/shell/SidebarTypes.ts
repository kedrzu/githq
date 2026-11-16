import type { LucideIcon } from 'lucide-vue-next';
import type { RouteLocationRaw } from 'vue-router';

import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';

/**
 * How a repository's workflows stand, as the marker on its icon says (actions W1): broken less than a day ago
 * (bright red), broken for longer (quiet red), or not read yet (a hollow ring).
 */
export type SidebarWorkflowMarker = 'new' | 'settled' | 'unread';

/** The entry "Broken workflows" (actions W1): what its count says and how loud it is. */
export interface SidebarBrokenWorkflows {
    /** `3`, `1+` while some repository is not read yet, `0` or `–` on its own screen with nothing broken. */
    readonly count: string;
    /** `new`: some break is under a day old (red); `settled`: every one is older; `none`: nothing broken. */
    readonly tone: 'new' | 'settled' | 'none';
}

/**
 * The counts of "my work" beside its entries: each group's top-level rows as its list counts them, `null` while its
 * search is still arriving; the total `null` until every group is in (first run and loading D14, G16, G17).
 */
export type SidebarMyWorkCounts = Readonly<Record<MyWorkGroup | 'total', number | null>>;

/**
 * A row under the open place in the sidebar: one of a repository's sections or one of a project's saved views — as its
 * tab shows it, with the tab's count.
 */
export interface SidebarSubEntry {
    /** Unique among the place's rows: the section, or the saved view's id. */
    readonly key: string;
    readonly label: string;
    /** Its address in githq. */
    readonly to: RouteLocationRaw;
    readonly icon: LucideIcon;
    /** As its tab counts it; blank for none, or while it is still arriving. */
    readonly count: string;
    /** It is the one shown, also while one of its items is open over it or full screen. */
    readonly current: boolean;
    /** The github.com address it leaves for instead, marked ↗ (Commits and Workflows on a phone, mobile D21). */
    readonly external?: string;
    /** A repository's Workflows with some broken: the red dot of "Broken workflows" (actions W1), bright or quiet. */
    readonly marker?: 'new' | 'settled';
    /** A saved view whose options were changed on this device (D13): a dot after its name. */
    readonly modified?: boolean;
    /** A saved view whose filter GitHub answers (K6): a cloud before its name. */
    readonly answered?: boolean;
}
