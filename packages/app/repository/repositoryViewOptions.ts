import type { ItemSort } from '@/lists/ItemSort.js';
import type { ListViewOptions } from '@/lists/ListTypes.js';

import type { RepositoryItemSection } from './RepositorySection.js';

/**
 * What a repository's issues or pull requests can be grouped by — GitHub's own properties (J2): its milestones,
 * assignees, authors, statuses, labels, issue types (issues only), or nothing.
 */
export type RepositoryGrouping = 'assignee' | 'author' | 'issueType' | 'label' | 'milestone' | 'none' | 'status';

/** Each section's groupings, in the order the grouping menu lists them: pull requests have no issue type. */
export const REPOSITORY_GROUPINGS: Readonly<Record<RepositoryItemSection, readonly RepositoryGrouping[]>> = {
    issues: ['none', 'milestone', 'assignee', 'author', 'status', 'label', 'issueType'],
    pullRequests: ['none', 'milestone', 'assignee', 'author', 'status', 'label'],
};

/**
 * How a repository's section is shown until the user changes it on this device: a list by milestone (J1), newest
 * first.
 */
export const REPOSITORY_VIEW_DEFAULTS: ListViewOptions<RepositoryGrouping, ItemSort> = {
    layout: 'list',
    grouping: 'milestone',
    sort: 'updated',
    properties: ['status', 'size', 'projectField', 'labels', 'people', 'updated'],
};
