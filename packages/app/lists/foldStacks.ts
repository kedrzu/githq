import { assertValue } from '@nzyme/utils/assert.js';

import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';
import { describeStackShare } from '@/store/stacks/describeStackShare.js';
import { getStackPullRequestToOpen } from '@/store/stacks/getStackPullRequestToOpen.js';
import type { PullRequestStack } from '@/store/stacks/groupStacks.js';

import type { ListGroup, ListRow } from './ListTypes.js';

/** What {@link foldStacks} folds. */
export interface FoldStacksParams<T> {
    /** In their order, rows sorted within each. */
    readonly groups: readonly ListGroup<T>[];
    /** The pull request an entry is; `null` for anything else (an issue, a draft). */
    readonly getPullRequest: (value: T) => PullRequestItem | null;
    /** The stacks of the local copy, by id (`groupStacks`). */
    readonly stacks: ReadonlyMap<string, PullRequestStack>;
    /** What the entry of a stack says about it (`describeStack`). */
    readonly describe: (stack: PullRequestStack) => StackDescription;
    /**
     * The ids of the rows the list's filter matches; `null` (or left out) when nothing is filtered. The groups also
     * hold the open pull requests of a stack any of which matches (`withStackMembers`), which show only beside one.
     */
    readonly matched?: ReadonlySet<string> | null;
}

/**
 * A list's groups with the rows of each stack folded into one entry per group (D2, D3): where a group lists two or more
 * open pull requests of one stack, they become an entry in place of the first of them — the best sorted — nesting them
 * in the stack's order. Where the stack's open pull requests are spread over groups, each entry is a share of them
 * (`share`, D16): "2 of 4", acting on its own pull requests alone. Its merged and closed ones stay plain rows of a list
 * that shows them; so does an open one alone in its group, or the last open one of its stack (D3), marked as part of
 * the stack (`stackMarker`, SP13).
 *
 * Under a filter (`matched`, D3, SP25) a stack shows in a group where any of its open pull requests there matches — all
 * of them, those not matching de-emphasised (`ListStack.unmatched`) — its entry in place of the best sorted one that
 * matches; in a group where none does, none of them shows. Any other row not matching is left out.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function foldStacks<T>(params: FoldStacksParams<T>): ListGroup<T>[] {
    const descriptions = new Map<string, StackDescription>();
    return params.groups.map(foldGroup);

    function foldGroup(group: ListGroup<T>): ListGroup<T> {
        const byStack = new Map<string, StackMemberRow<T>[]>();
        /** The stacks with a pull request matching the filter in this group. */
        const matching = new Set<string>();
        for (const row of group.rows) {
            const pullRequest = getOpenStacked(row);
            if (pullRequest?.stack) {
                const members = byStack.get(pullRequest.stack.id) ?? [];
                members.push({ row, pullRequest, position: pullRequest.stack.position });
                byStack.set(pullRequest.stack.id, members);
                if (isMatched(row)) {
                    matching.add(pullRequest.stack.id);
                }
            }
        }

        if (byStack.size === 0 && group.rows.every(isMatched)) {
            return group;
        }

        const entries = new Map<string, ListRow<T>>();
        for (const [id, members] of byStack) {
            const stack = params.stacks.get(id);
            if (stack && members.length > 1 && matching.has(id)) {
                entries.set(id, getEntry(group, stack, members));
            }
        }

        const rows: ListRow<T>[] = [];
        const placed = new Set<string>();
        for (const row of group.rows) {
            const id = getOpenStacked(row)?.stack?.id;
            if (!isMatched(row)) {
                // Shown only as a pull request of a stack's entry that one matching places.
                continue;
            }

            const stack = id === undefined ? undefined : params.stacks.get(id);
            const entry = id === undefined ? undefined : entries.get(id);
            if (entry) {
                if (id !== undefined && !placed.has(id)) {
                    placed.add(id);
                    rows.push(entry);
                }
            } else if (stack) {
                rows.push({ ...row, stackMarker: describe(stack) });
            } else {
                rows.push(row);
            }
        }

        return { ...group, rows };
    }

    function isMatched(row: ListRow<T>) {
        return !params.matched || params.matched.has(row.id);
    }

    /**
     * The row's pull request when it is open and of a stack: a landed or closed one stays a plain row of a list that
     * shows them (the entry says how many landed).
     */
    function getOpenStacked(row: ListRow<T>) {
        const pullRequest = params.getPullRequest(row.value);
        return pullRequest?.stack && isOpenPullRequest(pullRequest) ? pullRequest : null;
    }

    function getEntry(group: ListGroup<T>, stack: PullRequestStack, members: StackMemberRow<T>[]): ListRow<T> {
        const ordered = members.toSorted((a, b) => a.position - b.position);
        const pullRequests = ordered.map(member => member.pullRequest);
        const toOpen = getStackPullRequestToOpen(pullRequests);
        // A stack is folded from two rows or more: there is always one to open.
        const opened = assertValue(ordered.find(member => member.pullRequest === toOpen) ?? ordered[0]);
        const description = describe(stack);
        const id = `stack:${stack.id}`;
        const unmatched = new Set(ordered.filter(member => !isMatched(member.row)).map(member => member.row.id));

        return {
            key: `${group.key}:${id}`,
            id,
            value: opened.row.value,
            nested: ordered.map(({ row }) => ({ key: row.key, id: row.id, value: row.value })),
            stack: {
                id: stack.id,
                description,
                open: opened.row.id,
                pullRequests,
                share: describeStackShare(description, pullRequests),
                unmatched: unmatched.size > 0 ? unmatched : null,
            },
        };
    }

    /** Described once per stack, whole, however many groups it is in. */
    function describe(stack: PullRequestStack): StackDescription {
        const description = descriptions.get(stack.id) ?? params.describe(stack);
        descriptions.set(stack.id, description);
        return description;
    }
}

/** A row of a group that is a pull request of a stack. */
interface StackMemberRow<T> {
    readonly row: ListRow<T>;
    readonly pullRequest: PullRequestItem;
    readonly position: number;
}
