import type { GitHubSdk } from '@githq/github/createGitHubRequester.js';
import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import type { Logger } from '@nzyme/logging/Logger.js';

import type { Item } from '@/store/ItemTypes.js';
import { toItem } from '@/store/toItem.js';

import { isNodeGone } from './utils/isNodeGone.js';

/** What {@link readItemsByIds} reads. */
export interface ReadItemsByIdsParams {
    readonly sdk: GitHubSdk;
    /** One batch (`ItemsByIds` takes up to 100; the sync asks for 50). */
    readonly ids: readonly string[];
    readonly logger: Logger;
}

/** The items read, and the ones GitHub says are gone. */
export interface ReadItemsByIdsResult {
    readonly read: readonly Item[];
    readonly gone: ReadonlySet<string>;
}

/**
 * Reads the issues and pull requests `ids` names (`ItemsByIds`), and tells the gone ones apart: `null` in the
 * answer, with `NOT_FOUND` at that node or no error at all. A node failing otherwise (hidden by an organisation's
 * restrictions) is neither — its kept copy stays; an item read with only a nested field refused is read. Both
 * are logged.
 */
export async function readItemsByIds(params: ReadItemsByIdsParams): Promise<ReadItemsByIdsResult> {
    const { sdk, ids, logger } = params;
    const errors: GitHubGraphQLErrorEntry[] = [];
    const { nodes } = await sdk.ItemsByIds({ ids: [...ids] }, { onPartialErrors: found => errors.push(...found) });

    const errorsByNode = groupNodeErrors(errors);
    const read: Item[] = [];
    const gone = new Set<string>();
    for (const [index, id] of ids.entries()) {
        const item = toItem(nodes[index] ?? null);
        const nodeErrors = errorsByNode.get(index) ?? [];
        if (item) {
            read.push(item);
            if (nodeErrors.length > 0) {
                logger.warn('Item read without the fields GitHub refused', { id, errors: nodeErrors });
            }
        } else if (isNodeGone(nodeErrors)) {
            gone.add(id);
        } else {
            logger.warn('Item could not be read; its kept copy stays', { id, errors: nodeErrors });
        }
    }

    return { read, gone };
}

/** The errors of a partial `nodes(ids:)` answer by the index of the node they belong to; others are left out. */
function groupNodeErrors(errors: readonly GitHubGraphQLErrorEntry[]) {
    const byNode = new Map<number, GitHubGraphQLErrorEntry[]>();
    for (const error of errors) {
        const [field, index] = error.path ?? [];
        if (field !== 'nodes' || typeof index !== 'number') {
            continue;
        }

        const nodeErrors = byNode.get(index) ?? [];
        nodeErrors.push(error);
        byNode.set(index, nodeErrors);
    }

    return byNode;
}
