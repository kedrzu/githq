import { assertNever } from '@nzyme/utils/assertNever.js';
import { Milestone } from 'lucide-vue-next';

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

/** A repository's list as its view shows it. */
export interface RepositoryList {
    readonly groups: readonly ListGroup<Item>[];
    /** How many items are listed, each once whichever groups it is under. */
    readonly count: number;
    /**
     * How many of the section's items the copy holds in any state: with none listed, whether the state hides them
     * (filtered out) or there is nothing to hide (nothing there; first run and loading D6).
     */
    readonly held: number;
    /**
     * Nothing is listed and what the state holds is still on its way, so not even its groups are known: ghosts stand
     * for all of it, never a list saying there is nothing (first run and loading D8, D17).
     */
    readonly arriving: boolean;
}

/** What the groups are called — the caller's translations. */
export interface RepositoryListTexts {
    /** The one group when nothing groups the list. */
    readonly all: string;
    readonly noMilestone: string;
    readonly noLabel: string;
    readonly unassigned: string;
    readonly noType: string;
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
    /** Which of its items are listed: its issues or its pull requests, each a section of its own (D14). */
    readonly kind: Item['kind'];
    readonly grouping: RepositoryGrouping;
    readonly sort: ItemSort;
    readonly texts: RepositoryListTexts;
    /**
     * What the state holds is still on its way — a browsed repository's first page, a tracked one's download not past
     * it yet: none listed means not known.
     */
    readonly arriving?: boolean;
}

/**
 * A repository's issues or its pull requests (J1, J2) in the chosen state, grouped by one of GitHub's own
 * properties and ordered within each group. Milestones come by due date, the soonest first, each with its
 * progress; labels, assignees and issue types by name; an item with two labels or assignees is under both. The
 * group of items without the value comes last. Items can be moved between milestones, labels, assignees and
 * issue types (an edit). With none listed while the state is still arriving, no groups at all: they are not known.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildRepositoryList(params: BuildRepositoryListParams): RepositoryList {
    const { items, state, kind, grouping, sort, texts, arriving = false } = params;

    const held = items.filter(item => item.kind === kind);
    const listed = held.filter(item => matchesState(item, state)).toSorted(getItemComparator(sort));

    if (arriving && listed.length === 0) {
        return { groups: [], count: 0, held: held.length, arriving: true };
    }

    return {
        groups: groupEntries({
            entries: listed,
            getId: item => item.id,
            grouping: getGrouping(grouping, items, texts),
        }),
        count: listed.length,
        held: held.length,
        arriving: false,
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
