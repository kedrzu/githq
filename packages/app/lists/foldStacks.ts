import { assertValue } from '@nzyme/utils/assert.js';

import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';
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
}

/**
 * A list's groups with the rows of each stack folded into one entry per group (D2, D3): where a group lists two or more
 * pull requests of one stack, they become an entry in place of the first of them — the best sorted — nesting them in the
 * stack's order. A stack with one open pull request left stays plain rows (D3), and so does one alone in its group.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function foldStacks<T>(params: FoldStacksParams<T>): ListGroup<T>[] {
    const descriptions = new Map<string, StackDescription>();
    return params.groups.map(foldGroup);

    function foldGroup(group: ListGroup<T>): ListGroup<T> {
        const byStack = new Map<string, StackMemberRow<T>[]>();
        for (const row of group.rows) {
            const pullRequest = params.getPullRequest(row.value);
            if (pullRequest?.stack) {
                const members = byStack.get(pullRequest.stack.id) ?? [];
                members.push({ row, pullRequest, position: pullRequest.stack.position });
                byStack.set(pullRequest.stack.id, members);
            }
        }

        const entries = new Map<string, ListRow<T>>();
        for (const [id, members] of byStack) {
            const stack = params.stacks.get(id);
            if (stack && members.length > 1 && stack.members.filter(isOpenPullRequest).length !== 1) {
                entries.set(id, getEntry(group, stack, members));
            }
        }

        if (entries.size === 0) {
            return group;
        }

        const rows: ListRow<T>[] = [];
        const placed = new Set<string>();
        for (const row of group.rows) {
            const id = params.getPullRequest(row.value)?.stack?.id;
            const entry = id === undefined ? undefined : entries.get(id);
            if (!entry) {
                rows.push(row);
            } else if (id !== undefined && !placed.has(id)) {
                placed.add(id);
                rows.push(entry);
            }
        }

        return { ...group, rows };
    }

    function getEntry(group: ListGroup<T>, stack: PullRequestStack, members: StackMemberRow<T>[]): ListRow<T> {
        const ordered = members.toSorted((a, b) => a.position - b.position);
        const pullRequests = ordered.map(member => member.pullRequest);
        const toOpen = getStackPullRequestToOpen(pullRequests);
        // A stack is folded from two rows or more: there is always one to open.
        const opened = assertValue(ordered.find(member => member.pullRequest === toOpen) ?? ordered[0]);
        const description = descriptions.get(stack.id) ?? params.describe(stack);
        descriptions.set(stack.id, description);
        const id = `stack:${stack.id}`;

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
            },
        };
    }
}

/** A row of a group that is a pull request of a stack. */
interface StackMemberRow<T> {
    readonly row: ListRow<T>;
    readonly pullRequest: PullRequestItem;
    readonly position: number;
}
