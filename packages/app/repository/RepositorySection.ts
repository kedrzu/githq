import { assertNever } from '@nzyme/utils/assertNever.js';

import type { Item } from '@/store/ItemTypes.js';

/**
 * A section of a repository's view (D14), on its own key and tab: its issues or its pull requests, each a list with
 * its own state, grouping, layout and display options, or its commits, drawn as a graph (git-client D10).
 */
export type RepositorySection = RepositoryItemSection | 'commits';

/** A section listing the repository's items: the list engine, its options and the tracking explanation apply. */
export type RepositoryItemSection = 'issues' | 'pullRequests';

/** The sections in the order the tabs show them; the first is on `1`, the next on `2`, and so on. */
export const REPOSITORY_SECTIONS: readonly RepositorySection[] = ['issues', 'pullRequests', 'commits'];

/**
 * Whether the section lists items, so the item list's code paths run for it.
 * @__NO_SIDE_EFFECTS__
 */
export function isItemSection(section: RepositorySection): section is RepositoryItemSection {
    switch (section) {
        case 'issues':
        case 'pullRequests':
            return true;
        case 'commits':
            return false;
        default:
            return assertNever(section);
    }
}

/**
 * The kind of item a section lists.
 * @__NO_SIDE_EFFECTS__
 */
export function getSectionItemKind(section: RepositoryItemSection): Item['kind'] {
    switch (section) {
        case 'issues':
            return 'issue';
        case 'pullRequests':
            return 'pullRequest';
        default:
            return assertNever(section);
    }
}
