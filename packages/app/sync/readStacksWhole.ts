import type { GitHubSdk } from '@githq/github/createGitHubRequester.js';
import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import type { Logger } from '@nzyme/logging/Logger.js';

import type { ItemStore } from '@/store/ItemStore.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import { toItem } from '@/store/toItem.js';

import { groupNodeErrors } from './utils/groupNodeErrors.js';
import { isNodeGone } from './utils/isNodeGone.js';

/** The most pull requests a GitHub stack holds, and the most `PullRequestStacks` asks of one. */
const STACK_MAX_SIZE = 100;

/** What {@link readStacksWhole} reads. */
export interface ReadStacksWholeParams {
    readonly sdk: GitHubSdk;
    /** One batch, with how many pull requests each is known to hold. */
    readonly stacks: readonly StackToRead[];
    /** The copy, for who left a stack. */
    readonly items: ItemStore;
    readonly logger: Logger;
}

/** A stack {@link readStacksWhole} reads. */
export interface StackToRead {
    /** The stack's node id. */
    readonly id: string;
    readonly size: number;
}

/**
 * Reads whole the stacks of one batch (`PullRequestStacks`): the items to write into the copy, or rejects when GitHub
 * could not be asked. The answer is what a stack holds: a held pull request it does not list has left the stack — all
 * of them when the stack is gone — which moves no `updated_at`, so nothing else would tell a closed one. Only a whole
 * answer tells who left: not one cut by `first`, or with an entry GitHub refused.
 *
 * @util
 */
export async function readStacksWhole(params: ReadStacksWholeParams): Promise<Item[]> {
    const { sdk, stacks, items, logger } = params;
    const errors: GitHubGraphQLErrorEntry[] = [];
    const { nodes } = await sdk.PullRequestStacks(
        {
            ids: stacks.map(stack => stack.id),
            // The batch's largest stack: GitHub charges for the entries asked, not those found.
            first: Math.min(STACK_MAX_SIZE, Math.max(...stacks.map(stack => stack.size))),
        },
        { onPartialErrors: found => errors.push(...found) },
    );
    if (errors.length > 0) {
        logger.warn('Pull request stacks read in part', { errors });
    }

    const errorsByNode = groupNodeErrors(errors);
    const read: Item[] = [];
    for (const [index, { id }] of stacks.entries()) {
        const node = nodes[index] ?? null;
        const nodeErrors = errorsByNode.get(index) ?? [];
        if (node === null || !('entries' in node)) {
            if (isNodeGone(nodeErrors)) {
                read.push(...leaveStack(id, new Set()));
            }

            continue;
        }

        const listed = new Set<string>();
        for (const entry of node.entries.nodes ?? []) {
            const item = toItem(entry?.pullRequest ?? null);
            if (item) {
                read.push(item);
                listed.add(item.id);
            }
        }

        if (nodeErrors.length === 0 && listed.size === node.entries.totalCount) {
            read.push(...leaveStack(id, listed));
        }
    }

    return read;

    /**
     * The held pull requests of stack `id` but those `listed`, out of it — as stored, so a change of the user's still
     * on its way does not become part of them.
     */
    function leaveStack(id: string, listed: ReadonlySet<string>) {
        const left: PullRequestItem[] = [];
        for (const { id: itemId } of items.all) {
            const item = items.getStored(itemId);
            if (item?.kind === 'pullRequest' && item.stack?.id === id && !listed.has(itemId)) {
                left.push({ ...item, stack: null });
            }
        }

        return left;
    }
}
