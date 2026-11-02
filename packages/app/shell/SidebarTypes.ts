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
