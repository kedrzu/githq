import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { AccountSession } from '@/auth/AccountSession.js';
import { EditQueue } from '@/edits/EditQueue.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { Clock } from '@/services/Clock.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import { createMergeEdit } from './createMergeEdit.js';
import type { MergeAnswer, MergeOptions, MergeRequest } from './MergeTypes.js';
import { toMergeOptions } from './toMergeOptions.js';

/** A merge {@link PullRequestMerger} sends. */
export interface MergeParams {
    /** The pull request as shown: its head commit is the one the merge names. */
    readonly item: PullRequestItem;
    readonly request: MergeRequest;
    /**
     * Whether the merge panel still shows what GitHub answers. A refusal at once is the panel's to show only then;
     * once it closed (or opened anew), the refusal is reported like a failed edit, so it is not lost.
     */
    readonly shown: () => boolean;
}

/**
 * Merges pull requests, one at a time (merging D9), for the merge panel: reads what the panel decides from when it
 * opens, and sends the merge as an edit through {@link EditQueue} — drawn as being merged until GitHub says how it
 * ended (D3). Nothing of it is kept.
 */
export type PullRequestMerger = Resolved<typeof PullRequestMerger>;
export const PullRequestMerger = defineService({
    name: 'PullRequestMerger',
    deps: {
        accounts: AccountSession,
        editor: ItemEditor,
        items: ItemStore,
        queue: EditQueue,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, editor, items, queue, clock, logger }) {
        return { readOptions, merge };

        /**
         * Reads the merge options of a pull request fresh (`PullRequestMergeOptions`), and writes the status read
         * with them into its row. `null` when it is no pull request GitHub shows the user, when GitHub could not be
         * asked, or when the account changed meanwhile. Never rejects.
         */
        async function readOptions(itemId: string): Promise<MergeOptions | null> {
            const account = accounts.current;
            if (!account) {
                return null;
            }

            // The protection of the base branch is not readable without admin rights: the rest of the answer is.
            const errors: GitHubGraphQLErrorEntry[] = [];
            let options: MergeOptions | null;
            try {
                const { node } = await account.sdk.PullRequestMergeOptions(
                    { id: itemId },
                    { onPartialErrors: found => errors.push(...found) },
                );
                options = toMergeOptions(node);
            } catch (error) {
                logger.warn('Merge options were not read', { itemId, error });
                return null;
            }

            if (!accounts.isCurrent(account)) {
                return null;
            }

            if (errors.length > 0) {
                logger.debug('Merge options read in part', { itemId, errors });
            }

            // As stored: a change of the user's still on its way must not become part of it.
            const stored = items.getStored(itemId);
            if (options && stored?.kind === 'pullRequest') {
                items.upsertMany([{ ...stored, ...options.status }]);
            }

            return options;
        }

        /**
         * Merges the pull request as shown, with its head commit. Resolves once GitHub took the merge
         * (`accepted`: it runs on, drawn as being merged, and a later refusal is reported like a failed edit) or
         * refused it at once (`refused`: for the panel to show — reported elsewhere only when the panel no longer
         * shows it, {@link MergeParams.shown}). Refused as not allowed without being sent when the user may not
         * merge it, or it is being merged already.
         */
        async function merge(params: MergeParams): Promise<MergeAnswer> {
            const { item, request, shown } = params;
            const account = accounts.current;
            const merging = queue.pending.some(edit => edit.itemId === item.id && edit.subject.kind === 'merged');
            if (!account || merging || !editor.getPermissions(item).merge) {
                return { kind: 'refused', reason: { kind: 'notAllowed' } };
            }

            const answered = createPromise<MergeAnswer>();
            const edit = createMergeEdit({ item, request, clock, shown, onAnswer: answered.resolve });
            void queue.submit({ edits: [edit], account, itemCount: 1 }).finally(() => {
                // Never sent: another account signed in, or none, meanwhile. Settled already otherwise.
                answered.resolve({ kind: 'refused', reason: { kind: 'notAllowed' } });
            });
            return await answered.promise;
        }
    },
});
