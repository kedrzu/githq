import { assertNever } from '@nzyme/utils/assertNever.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
    CircleCheck,
    CircleDot,
    CircleSlash,
    CircleX,
    GitMerge,
    GitPullRequestClosed,
    GitPullRequestDraft,
    Hourglass,
    ListOrdered,
    Loader,
    Milestone,
} from 'lucide-vue-next';

import { getItemComparator } from '@/lists/getItemComparator.js';
import type { ListGrouping } from '@/lists/groupEntries.js';
import { getAssigneeGroupValue, getUngroupedGrouping, groupEntries, NO_VALUE } from '@/lists/groupEntries.js';
import type { ItemSort } from '@/lists/ItemSort.js';
import type { ListGroup } from '@/lists/ListTypes.js';
import type { PullRequestStage } from '@/store/getPullRequestPhase.js';
import { getPullRequestPhase, PULL_REQUEST_STAGE_OF, PULL_REQUEST_STAGES } from '@/store/getPullRequestPhase.js';
import type { IssueItem, Item } from '@/store/ItemTypes.js';
import { getGitHubColor } from '@/utils/getGitHubColor.js';

import type { RepositoryGrouping } from './repositoryViewOptions.js';

/** Which of a repository's items are listed: open (the default), closed or both. */
export type RepositoryState = 'all' | 'closed' | 'open';

/** The states in the order the filter menu lists them. */
export const REPOSITORY_STATES: readonly RepositoryState[] = ['open', 'closed', 'all'];

/** Where an issue stands, as its row's icon tells: open, closed as completed, or closed for any other reason. */
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** The issue statuses in the order their groups are shown. */
export const ISSUE_STATUSES = ['open', 'closed', 'notPlanned'] as const;

/** A repository's list as its view shows it. */
export interface RepositoryList {
    readonly groups: readonly ListGroup<Item>[];
    /** How many items are listed, each once whichever groups it is under. */
    readonly count: number;
}

/** What the groups are called — the caller's translations. */
export interface RepositoryListTexts {
    /** The one group when nothing groups the list. */
    readonly all: string;
    readonly noMilestone: string;
    readonly noLabel: string;
    readonly unassigned: string;
    readonly noType: string;
    readonly noAuthor: string;
    /** A pull request's "Status" group, by its stage. */
    readonly pullRequestStages: Readonly<Record<PullRequestStage, string>>;
    /** An issue's "Status" group. */
    readonly issueStatuses: Readonly<Record<IssueStatus, string>>;
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
    /** GitHub has not said yet what the state holds (a browsed repository's first page): none listed means not known. */
    readonly arriving?: boolean;
}

/**
 * A repository's issues or its pull requests (J1, J2) in the chosen state, grouped by one of GitHub's own
 * properties and ordered within each group. Milestones come by due date, the soonest first, each with its
 * progress; labels, assignees, authors and issue types by name; an item with two labels or assignees is under both.
 * The group of items without the value comes last. By status, each item is under one: a pull request under the stage
 * its row's status line tells, an issue open, closed or not planned, in that fixed order, only those with items
 * shown. Items can be moved between milestones, labels, assignees and issue types (an edit), never between statuses
 * or authors.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildRepositoryList(params: BuildRepositoryListParams): RepositoryList {
    const { items, state, kind, grouping, sort, texts, arriving = false } = params;

    const listed = items
        .filter(item => item.kind === kind && matchesState(item, state))
        .toSorted(getItemComparator(sort));

    if (arriving && listed.length === 0) {
        return {
            groups: [{ key: 'arriving', label: texts.all, arrived: false, droppable: false, rows: [] }],
            count: 0,
        };
    }

    return {
        groups: groupEntries({
            entries: listed,
            getId: item => item.id,
            grouping: getGrouping(grouping, kind, items, texts),
        }),
        count: listed.length,
    };
}

function getGrouping(
    grouping: RepositoryGrouping,
    kind: Item['kind'],
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
        case 'author':
            return {
                values: item => (item.author ? [getAssigneeGroupValue(item.author)] : []),
                // A deleted account leaves no author.
                none: { key: NO_VALUE, label: texts.noAuthor },
                movable: false,
            };
        case 'status':
            return kind === 'pullRequest' ? getPullRequestStatusGrouping(texts) : getIssueStatusGrouping(texts);
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

const PULL_REQUEST_STAGE_ICONS: Readonly<Record<PullRequestStage, LucideIcon>> = {
    draft: GitPullRequestDraft,
    waitingForReview: Hourglass,
    needsWork: CircleX,
    checksRunning: Loader,
    readyToMerge: CircleCheck,
    merging: ListOrdered,
    merged: GitMerge,
    closed: GitPullRequestClosed,
};

const ISSUE_STATUS_ICONS: Readonly<Record<IssueStatus, LucideIcon>> = {
    open: CircleDot,
    closed: CircleCheck,
    notPlanned: CircleSlash,
};

// Every item has a status: the group of those without one is never shown.
function getPullRequestStatusGrouping(texts: RepositoryListTexts): ListGrouping<Item> {
    return {
        values: item => {
            if (item.kind !== 'pullRequest') {
                return [];
            }

            const stage = PULL_REQUEST_STAGE_OF[getPullRequestPhase(item, { reviewRequested: false })];
            return [
                {
                    key: stage,
                    label: texts.pullRequestStages[stage],
                    marker: { kind: 'icon', icon: PULL_REQUEST_STAGE_ICONS[stage] },
                },
            ];
        },
        none: { key: NO_VALUE, label: texts.all },
        movable: false,
        compare: (a, b) => getStageIndex(a.key) - getStageIndex(b.key),
    };
}

function getIssueStatusGrouping(texts: RepositoryListTexts): ListGrouping<Item> {
    return {
        values: item => {
            if (item.kind !== 'issue') {
                return [];
            }

            const status = getIssueStatus(item);
            return [
                {
                    key: status,
                    label: texts.issueStatuses[status],
                    marker: { kind: 'icon', icon: ISSUE_STATUS_ICONS[status] },
                },
            ];
        },
        none: { key: NO_VALUE, label: texts.all },
        movable: false,
        compare: (a, b) => getIssueStatusIndex(a.key) - getIssueStatusIndex(b.key),
    };
}

function getStageIndex(key: string) {
    return PULL_REQUEST_STAGES.findIndex(stage => stage === key);
}

function getIssueStatusIndex(key: string) {
    return ISSUE_STATUSES.findIndex(status => status === key);
}

/** The split of the row's icon (`useItemFacts`): a closed issue with no reason given counts as completed. */
function getIssueStatus(issue: IssueItem): IssueStatus {
    if (issue.state === 'OPEN') {
        return 'open';
    }

    return issue.stateReason === 'COMPLETED' || issue.stateReason === null ? 'closed' : 'notPlanned';
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
