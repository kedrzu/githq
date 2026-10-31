import { assertNever } from '@nzyme/utils/assertNever.js';
import { CircleDot, GitPullRequest, Milestone } from 'lucide-vue-next';

import { getItemComparator } from '@/lists/getItemComparator.js';
import type { ListGrouping } from '@/lists/groupEntries.js';
import { getAssigneeGroupValue, getUngroupedGrouping, groupEntries, NO_VALUE } from '@/lists/groupEntries.js';
import type { ItemSort } from '@/lists/ItemSort.js';
import type { ListGroup } from '@/lists/ListTypes.js';
import type { Item } from '@/store/ItemTypes.js';
import { getGitHubColor } from '@/utils/getGitHubColor.js';

import type { RepositoryGrouping } from './repositoryViewOptions.js';

/** Which of a repository's items are listed: open (the default), closed or both. */
export type RepositoryState = 'all' | 'closed' | 'open';

/** The states in the order the filter menu lists them. */
export const REPOSITORY_STATES: readonly RepositoryState[] = ['open', 'closed', 'all'];

/** Which kinds of a repository's items are listed: both, issues or pull requests. */
export type RepositoryKind = 'all' | 'issues' | 'pullRequests';

/** The kinds in the order the tabs show them. */
export const REPOSITORY_KINDS: readonly RepositoryKind[] = ['all', 'issues', 'pullRequests'];

/** A repository's list as its view shows it. */
export interface RepositoryList {
    readonly groups: readonly ListGroup<Item>[];
    /** How many items each kind tab holds, in the chosen state. */
    readonly counts: Readonly<Record<RepositoryKind, number>>;
}

/** What the groups are called — the caller's translations. */
export interface RepositoryListTexts {
    /** The one group when nothing groups the list. */
    readonly all: string;
    readonly noMilestone: string;
    readonly noLabel: string;
    readonly unassigned: string;
    readonly noType: string;
    readonly issues: string;
    readonly pullRequests: string;
    /** A milestone's header detail: how far it is and when it is due ("7 of 11 closed · due Nov 15"). */
    milestoneDetail(progress: MilestoneProgress): string;
}

/** How far a milestone is, counted over the repository's copy, closed items included. */
export interface MilestoneProgress {
    readonly closed: number;
    readonly total: number;
    readonly dueOn: string | null;
}

/** What {@link buildRepositoryList} lists. */
export interface BuildRepositoryListParams {
    /** Every item of the repository in the local copy, open and closed. */
    readonly items: readonly Item[];
    readonly state: RepositoryState;
    readonly kind: RepositoryKind;
    readonly grouping: RepositoryGrouping;
    readonly sort: ItemSort;
    readonly texts: RepositoryListTexts;
}

/**
 * A repository's issues and pull requests (J1, J2) in the chosen state and kind, grouped by one of GitHub's own
 * properties and ordered within each group. Milestones come by due date, the soonest first, each with its
 * progress; labels, assignees and issue types by name; an item with two labels or assignees is under both. The
 * group of items without the value comes last. Items can be moved between milestones, labels, assignees and
 * issue types (an edit), not between issues and pull requests.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildRepositoryList(params: BuildRepositoryListParams): RepositoryList {
    const { items, state, kind, grouping, sort, texts } = params;

    const inState = items.filter(item => matchesState(item, state));
    const counts = {
        all: inState.length,
        issues: inState.filter(item => item.kind === 'issue').length,
        pullRequests: inState.filter(item => item.kind === 'pullRequest').length,
    };
    const listed = inState.filter(item => matchesKind(item, kind)).toSorted(getItemComparator(sort));

    return {
        groups: groupEntries({
            entries: listed,
            getId: item => item.id,
            grouping: getGrouping(grouping, items, texts),
        }),
        counts,
    };
}

function getGrouping(
    grouping: RepositoryGrouping,
    items: readonly Item[],
    texts: RepositoryListTexts,
): ListGrouping<Item> {
    switch (grouping) {
        case 'none':
            return getUngroupedGrouping(texts.all);
        case 'milestone':
            return getMilestoneGrouping(items, texts);
        case 'label':
            return {
                values: item =>
                    item.labels.map(label => ({
                        key: label.name,
                        label: label.name,
                        marker: { kind: 'color', color: label.color },
                    })),
                none: { key: NO_VALUE, label: texts.noLabel },
                movable: true,
            };
        case 'assignee':
            return {
                values: item => item.assignees.map(getAssigneeGroupValue),
                none: { key: NO_VALUE, label: texts.unassigned },
                movable: true,
            };
        case 'issueType':
            return {
                values: item =>
                    item.kind === 'issue' && item.issueType
                        ? [
                              {
                                  key: item.issueType.name,
                                  label: item.issueType.name,
                                  marker: { kind: 'color', color: getGitHubColor(item.issueType.color) },
                              },
                          ]
                        : [],
                none: { key: NO_VALUE, label: texts.noType },
                movable: true,
            };
        case 'kind':
            return {
                fixed: [
                    { key: 'issue', label: texts.issues, marker: { kind: 'icon', icon: CircleDot } },
                    { key: 'pullRequest', label: texts.pullRequests, marker: { kind: 'icon', icon: GitPullRequest } },
                ],
                values: item => [{ key: item.kind, label: '' }],
                none: { key: NO_VALUE, label: '' },
                movable: false,
            };
        default:
            return assertNever(grouping);
    }
}

function getMilestoneGrouping(items: readonly Item[], texts: RepositoryListTexts): ListGrouping<Item> {
    // Progress is counted over the whole copy, whatever the filters show.
    const progress = new Map<string, MilestoneProgress>();
    for (const item of items) {
        if (item.milestone) {
            const { title, dueOn } = item.milestone;
            const counted = progress.get(title) ?? { closed: 0, total: 0, dueOn };
            progress.set(title, {
                closed: counted.closed + (item.state === 'OPEN' ? 0 : 1),
                total: counted.total + 1,
                dueOn,
            });
        }
    }

    return {
        values: item => {
            const counted = item.milestone && progress.get(item.milestone.title);
            return item.milestone && counted
                ? [
                      {
                          key: item.milestone.title,
                          label: item.milestone.title,
                          marker: { kind: 'icon', icon: Milestone },
                          detail: texts.milestoneDetail(counted),
                      },
                  ]
                : [];
        },
        none: { key: NO_VALUE, label: texts.noMilestone },
        movable: true,
        // The soonest due first, those without a date after them; by title within.
        compare: (a, b) => {
            const dueA = progress.get(a.key)?.dueOn ?? null;
            const dueB = progress.get(b.key)?.dueOn ?? null;
            if (dueA !== dueB) {
                if (dueA === null) {
                    return 1;
                }

                if (dueB === null) {
                    return -1;
                }

                return dueA < dueB ? -1 : 1;
            }

            return a.label.localeCompare(b.label);
        },
    };
}

function matchesState(item: Item, state: RepositoryState) {
    switch (state) {
        case 'open':
            return item.state === 'OPEN';
        case 'closed':
            return item.state !== 'OPEN';
        case 'all':
            return true;
        default:
            return assertNever(state);
    }
}

function matchesKind(item: Item, kind: RepositoryKind) {
    switch (kind) {
        case 'all':
            return true;
        case 'issues':
            return item.kind === 'issue';
        case 'pullRequests':
            return item.kind === 'pullRequest';
        default:
            return assertNever(kind);
    }
}
