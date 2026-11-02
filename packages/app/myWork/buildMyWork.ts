import { assertNever } from '@nzyme/utils/assertNever.js';

import { getItemComparator } from '@/lists/getItemComparator.js';
import type { ItemSort } from '@/lists/ItemSort.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import type { MyWorkGroup, MyWorkMembership } from '@/store/ItemStoreTypes.js';
import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import { getStackPullRequestToOpen } from '@/store/stacks/getStackPullRequestToOpen.js';
import type { PullRequestStack } from '@/store/stacks/groupStacks.js';

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

/**
 * A top-level row, with the user's pull requests that close it nested under it (issues assigned to them only) — or a
 * stack's entry: its open pull requests nested in the stack's order, `item` the one `Enter` opens.
 */
export interface MyWorkRow {
    readonly item: Item;
    readonly nested: readonly PullRequestItem[];
    /** Set on a stack's entry: the whole stack, whatever its pull requests' states. */
    readonly stack: PullRequestStack | null;
}

/** What "my work" is built from. */
export interface BuildMyWorkParams {
    /** Which search found which item — the item store's sets, of the groups that have arrived. */
    readonly membership: MyWorkMembership;
    /** An item of the local copy by id; `undefined` when it is not there (yet). */
    readonly getItem: (id: string) => Item | undefined;
    /**
     * The stacks of the local copy, by id (`groupStacks`): whole, with pull requests in no group of my work too. Empty
     * for the board, until it draws stacks: each pull request a plain row of its own group.
     */
    readonly stacks: ReadonlyMap<string, PullRequestStack>;
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
 * A stack with two open pull requests or more is one entry, whole (stacked PRs D3, D7): in the first group any of its
 * pull requests is in, nesting every open pull request of the stack — those in no group too (someone else's, on a stack
 * my review was asked on) — and none of them is a row anywhere else. The entry takes the place its best sorted pull
 * request would. A stacked pull request is not nested under an assigned issue (D12 is still to come); a stack with
 * one open pull request left is a plain row.
 *
 * The filter keeps a top-level row when it, or a pull request nested under it, matches — a stack's entry when any of
 * its pull requests would as a row of its group:
 *
 * - `needsMe`: every review requested from me, my pull requests with failing checks, changes requested or
 *   conflicts, every issue assigned to me — never a mention alone;
 * - `waitingOnOthers`: my pull requests waiting for a review or for running checks, whether or not they also
 *   need me (an assigned issue stays, as their parent, when such a pull request is nested under it);
 * - `all`.
 *
 * Counts are of the top-level rows left: a stack counts once.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildMyWork(params: BuildMyWorkParams): MyWork {
    const { membership, getItem, filter } = params;
    const compare = getItemComparator(params.sort);

    const placed = new Set<string>();
    /** The open pull requests of each stack placed as an entry, in the stack's order. */
    const stackMembers = new Map<string, PullRequestItem[]>();
    const rowsByGroup = new Map<MyWorkGroup, Item[]>();
    for (const group of MY_WORK_GROUPS) {
        const items: Item[] = [];
        for (const id of membership[group] ?? []) {
            const item = getItem(id);
            if (placed.has(id) || !item || item.state !== 'OPEN') {
                continue;
            }

            const stack = item.kind === 'pullRequest' && item.stack ? params.stacks.get(item.stack.id) : undefined;
            const members = stack ? getOpenMembers(stack, getItem) : [];
            if (stack && members.length > 1) {
                // The whole stack goes here; its members are sorted with the rest, the best of them giving its place.
                stackMembers.set(stack.id, members);
                for (const member of members) {
                    placed.add(member.id);
                    items.push(member);
                }

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
        const stacked = item.kind === 'pullRequest' && item.stack !== null && stackMembers.has(item.stack.id);
        const issueId = item.kind === 'pullRequest' && !stacked ? firstAssignedIssue(item, assignedOrder) : null;
        if (item.kind !== 'pullRequest' || issueId === null) {
            authored.push(item);
            continue;
        }

        const nested = nestedByIssue.get(issueId) ?? [];
        nested.push(item);
        nestedByIssue.set(issueId, nested);
    }

    rowsByGroup.set('authored', authored);

    const entered = new Set<string>();
    const groups: MyWorkGroupRows[] = [];
    const counts: Record<MyWorkGroup, number> = { reviewRequested: 0, authored: 0, assigned: 0, mentioned: 0 };
    let total = 0;
    for (const group of MY_WORK_GROUPS) {
        const rows: MyWorkRow[] = [];
        for (const item of rowsByGroup.get(group) ?? []) {
            const row = getRow(item);
            if (row && matchesFilter(row, group, filter)) {
                rows.push(row);
            }
        }

        groups.push({ group, arrived: membership[group] !== undefined, rows });
        counts[group] = rows.length;
        total += rows.length;
    }

    return { groups, counts: { ...counts, total } };

    /** The row an item gives: a stack's entry for its best sorted pull request, nothing for the rest of them. */
    function getRow(item: Item): MyWorkRow | null {
        const stackId = item.kind === 'pullRequest' ? item.stack?.id : undefined;
        const members = stackId === undefined ? undefined : stackMembers.get(stackId);
        if (stackId === undefined || !members) {
            return { item, nested: nestedByIssue.get(item.id) ?? [], stack: null };
        }

        if (entered.has(stackId)) {
            return null;
        }

        entered.add(stackId);
        return {
            // An entry has two open pull requests or more: there is always one to open.
            item: getStackPullRequestToOpen(members) ?? item,
            nested: members,
            stack: params.stacks.get(stackId) ?? null,
        };
    }
}

/** A stack's open pull requests in its order, as the local copy holds them now. */
function getOpenMembers(stack: PullRequestStack, getItem: (id: string) => Item | undefined): PullRequestItem[] {
    const open: PullRequestItem[] = [];
    for (const member of stack.members) {
        const item = getItem(member.id) ?? member;
        if (item.kind === 'pullRequest' && isOpenPullRequest(item)) {
            open.push(item);
        }
    }

    return open;
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
    if (row.stack) {
        // A stack's entry stays when any of its pull requests would, as a row of the group.
        return row.nested.some(item => matchesFilter({ item, nested: [], stack: null }, group, filter));
    }

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
