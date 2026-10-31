import { ITEM_PROPERTIES } from '@/lists/ItemProperty.js';
import type { ItemSort } from '@/lists/ItemSort.js';
import { ITEM_SORTS } from '@/lists/ItemSort.js';
import type { ListViewOptions } from '@/lists/ListTypes.js';
import type { ListViewChoices } from '@/lists/useListViewOptions.js';

/**
 * What a repository's issues and pull requests can be grouped by — GitHub's own properties (J2): its
 * milestones, labels, assignees, issue types, issues versus pull requests, or nothing.
 */
export type RepositoryGrouping = 'assignee' | 'issueType' | 'kind' | 'label' | 'milestone' | 'none';

/** The groupings in the order the grouping menu lists them. */
export const REPOSITORY_GROUPINGS: readonly RepositoryGrouping[] = [
    'none',
    'milestone',
    'assignee',
    'label',
    'issueType',
    'kind',
];

/** How a repository is shown until the user changes it on this device: a list by milestone (J1), newest first. */
export const REPOSITORY_VIEW_DEFAULTS: ListViewOptions<RepositoryGrouping, ItemSort> = {
    layout: 'list',
    grouping: 'milestone',
    sort: 'updated',
    properties: ['status', 'projectField', 'labels', 'people', 'updated'],
};

/** What a repository's view options may be set to. */
export const REPOSITORY_VIEW_CHOICES: ListViewChoices<RepositoryGrouping, ItemSort> = {
    groupings: REPOSITORY_GROUPINGS,
    sorts: ITEM_SORTS,
    properties: ITEM_PROPERTIES,
};
