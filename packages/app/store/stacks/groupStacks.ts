import type { Item, PullRequestItem } from '@/store/ItemTypes.js';

/** A GitHub stack as the local copy holds it: the pull requests of one stack id, whatever their state. */
export interface PullRequestStack {
    /** The stack's node id. */
    readonly id: string;
    /** The stack's number within its repository. */
    readonly number: number;
    /**
     * How many pull requests the stack holds: the largest any member says — or a member's position, should a
     * stale copy place one beyond it — so every member has a place up to it.
     */
    readonly size: number;
    /** Open, merged and closed alike, by position; fewer than {@link size} while the copy is incomplete (D7). */
    readonly members: readonly PullRequestItem[];
}

/**
 * The stacks the given items belong to, by stack id: every pull request with that stack id is a member.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function groupStacks(items: Iterable<Item>): Map<string, PullRequestStack> {
    const stacks = new Map<string, MutableStack>();
    for (const item of items) {
        if (item.kind !== 'pullRequest' || item.stack === null) {
            continue;
        }

        const ref = item.stack;

        const size = Math.max(ref.size, ref.position);
        const stack = stacks.get(ref.id);
        if (stack) {
            stack.size = Math.max(stack.size, size);
            stack.members.push({ position: ref.position, pullRequest: item });
        } else {
            stacks.set(ref.id, { number: ref.number, size, members: [{ position: ref.position, pullRequest: item }] });
        }
    }

    const result = new Map<string, PullRequestStack>();
    for (const [id, stack] of stacks) {
        stack.members.sort((a, b) => a.position - b.position);
        result.set(id, {
            id,
            number: stack.number,
            size: stack.size,
            members: stack.members.map(member => member.pullRequest),
        });
    }

    return result;
}

/** A stack while its members are gathered. */
interface MutableStack {
    readonly number: number;
    size: number;
    readonly members: StackMemberAtPosition[];
}

/** A member with its position, which its `stack` holds but no longer narrows to. */
interface StackMemberAtPosition {
    readonly position: number;
    readonly pullRequest: PullRequestItem;
}
