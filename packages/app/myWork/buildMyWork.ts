import { assertNever } from '@nzyme/utils/assertNever.js';

import { getItemComparator } from '@/lists/getItemComparator.js';
import type { ItemSort } from '@/lists/ItemSort.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import type { MyWorkGroup, MyWorkMembership } from '@/store/ItemStoreTypes.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';

/** The filters on top of "my work" (D11). */
export type MyWorkFilter = 'all' | 'needsMe' | 'waitingOnOthers';

/** The filters in the order the tabs show them. */
export const MY_WORK_FILTERS: readonly MyWorkFilter[] = ['all', 'needsMe', 'waitingOnOthers'];

/** "My work" as the list shows it: the four groups in order, each with its top-level rows. */
export interface MyWork {
    readonly groups: readonly MyWorkGroupRows[];
    /** Top-level rows per group — what the sidebar shows next to each group. */
    readonly counts: MyWorkCounts;
}

/** How many top-level rows each group has, and their sum ("My work" in the sidebar). */
export interface MyWorkCounts extends Readonly<Record<MyWorkGroup, number>> {
    readonly total: number;
}

/** A group of "my work" and its rows; empty groups are kept, the list decides whether to show them. */
export interface MyWorkGroupRows {
    readonly group: MyWorkGroup;
    /** Its search has answered at least once; until then it has no rows and is still arriving (G7). */
    readonly arrived: boolean;
    readonly rows: readonly MyWorkRow[];
}

/** A top-level row, with the user's pull requests that close it nested under it (issues assigned to them only). */
export interface MyWorkRow {
    readonly item: Item;
    readonly nested: readonly PullRequestItem[];
}

/** What "my work" is built from. */
export interface BuildMyWorkParams {
    /** Which search found which item — the item store's sets, of the groups that have arrived. */
    readonly membership: MyWorkMembership;
    /** An item of the local copy by id; `undefined` when it is not there (yet). */
    readonly getItem: (id: string) => Item | undefined;
    readonly filter: MyWorkFilter;
    /** The order of the rows, and of the pull requests nested under one. */
    readonly sort: ItemSort;
}

/**
 * "My work" (D11): open issues and pull requests in four groups, each item once — in the first group that
 * applies (review requested → my pull requests → assigned to me → mentioned). A pull request of mine that
 * closes an issue in "Assigned to me" is nested under that issue — the first in the list — and nowhere else; if
 * it closes none there, it is a row of "My pull requests". Rows are in `sort`'s order.
 *
 * The filter keeps a top-level row when it, or a pull request nested under it, matches:
 *
 * - `needsMe`: every review requested from me, my pull requests with failing checks, changes requested or
 *   conflicts, every issue assigned to me — never a mention alone;
 * - `waitingOnOthers`: my pull requests waiting for a review or for running checks, whether or not they also
 *   need me (an assigned issue stays, as their parent, when such a pull request is nested under it);
 * - `all`.
 *
 * Counts are of the top-level rows left.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildMyWork(params: BuildMyWorkParams): MyWork {
    const { membership, getItem, filter } = params;
    const compare = getItemComparator(params.sort);

    const placed = new Set<string>();
    const rowsByGroup = new Map<MyWorkGroup, Item[]>();
    for (const group of MY_WORK_GROUPS) {
        const items: Item[] = [];
        for (const id of membership[group] ?? []) {
            const item = getItem(id);
            if (placed.has(id) || !item || item.state !== 'OPEN') {
                continue;
            }

            placed.add(id);
            items.push(item);
        }

        rowsByGroup.set(group, items.toSorted(compare));
    }

    // My pull requests that close an assigned issue move under it — under the first such issue in the list.
    const assigned = rowsByGroup.get('assigned') ?? [];
    const assignedOrder = new Map(assigned.map((item, index) => [item.id, index]));
    const nestedByIssue = new Map<string, PullRequestItem[]>();
    const authored: Item[] = [];
    for (const item of rowsByGroup.get('authored') ?? []) {
        const issueId = item.kind === 'pullRequest' ? firstAssignedIssue(item, assignedOrder) : null;
        if (item.kind !== 'pullRequest' || issueId === null) {
            authored.push(item);
            continue;
        }

        const nested = nestedByIssue.get(issueId) ?? [];
        nested.push(item);
        nestedByIssue.set(issueId, nested);
    }

    rowsByGroup.set('authored', authored);

    const groups: MyWorkGroupRows[] = [];
    const counts: Record<MyWorkGroup, number> = { reviewRequested: 0, authored: 0, assigned: 0, mentioned: 0 };
    let total = 0;
    for (const group of MY_WORK_GROUPS) {
        const rows: MyWorkRow[] = [];
        for (const item of rowsByGroup.get(group) ?? []) {
            const row: MyWorkRow = { item, nested: nestedByIssue.get(item.id) ?? [] };
            if (matchesFilter(row, group, filter)) {
                rows.push(row);
            }
        }

        groups.push({ group, arrived: membership[group] !== undefined, rows });
        counts[group] = rows.length;
        total += rows.length;
    }

    return { groups, counts: { ...counts, total } };
}

function firstAssignedIssue(pr: PullRequestItem, assignedOrder: ReadonlyMap<string, number>) {
    let first: string | null = null;
    let firstIndex = Number.POSITIVE_INFINITY;
    for (const id of pr.closingIssueIds) {
        const index = assignedOrder.get(id);
        if (index !== undefined && index < firstIndex) {
            first = id;
            firstIndex = index;
        }
    }

    return first;
}

function matchesFilter(row: MyWorkRow, group: MyWorkGroup, filter: MyWorkFilter): boolean {
    switch (filter) {
        case 'all':
            return true;
        case 'needsMe':
            return needsMe(row, group);
        case 'waitingOnOthers':
            return isWaitingOnOthers(row, group);
        default:
            return assertNever(filter);
    }
}

function needsMe(row: MyWorkRow, group: MyWorkGroup): boolean {
    switch (group) {
        case 'reviewRequested':
        case 'assigned':
            return true;
        case 'authored':
            return row.item.kind === 'pullRequest' && getPullRequestStanding(row.item).needsAuthor;
        case 'mentioned':
            return false;
        default:
            return assertNever(group);
    }
}

function isWaitingOnOthers(row: MyWorkRow, group: MyWorkGroup): boolean {
    switch (group) {
        case 'authored':
            return row.item.kind === 'pullRequest' && getPullRequestStanding(row.item).waitingOnOthers;
        case 'assigned':
            return row.nested.some(pr => getPullRequestStanding(pr).waitingOnOthers);
        case 'reviewRequested':
        case 'mentioned':
            return false;
        default:
            return assertNever(group);
    }
}
