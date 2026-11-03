import { assertNever } from '@nzyme/utils/assertNever.js';

import type { Item } from '@/store/ItemTypes.js';

/**
 * A section of a repository's view (D14), on its own key and tab: its issues or its pull requests, each a list with
 * its own state, grouping, layout and display options.
 */
export type RepositorySection = 'issues' | 'pullRequests';

/** The sections in the order the tabs show them; the first is on `1`, the next on `2`. */
export const REPOSITORY_SECTIONS: readonly RepositorySection[] = ['issues', 'pullRequests'];

/** The kind of item a section lists. */
export function getSectionItemKind(section: RepositorySection): Item['kind'] {
    switch (section) {
        case 'issues':
            return 'issue';
        case 'pullRequests':
            return 'pullRequest';
        default:
            return assertNever(section);
    }
}
