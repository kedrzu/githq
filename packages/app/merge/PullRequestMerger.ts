import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { AccountSession } from '@/auth/AccountSession.js';
import { EditQueue } from '@/edits/EditQueue.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { Clock } from '@/services/Clock.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import { createMergeEdit } from './createMergeEdit.js';
import type { MergeAnswer, MergeLateEnd, MergeOptions, MergeRequest } from './MergeTypes.js';
import { toMergeOptions } from './toMergeOptions.js';

/** A merge {@link PullRequestMerger} sends. */
export interface MergeParams {
    /** The pull request as shown: its head commit is the one the merge names. */
    readonly item: PullRequestItem;
    readonly request: MergeRequest;
    /**
     * Whether the merge panel shows the pull request. A refusal is the panel's to show only then; once it closed (or
     * opened for another), the refusal is reported like a failed edit, so it is not lost.
     */
    readonly shown: () => boolean;
    /** Told how a merge GitHub accepted ended: merged, refused while it ran, or no answer in time. */
    readonly onLateEnd: (end: MergeLateEnd) => void;
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
        details: ItemDetailStore,
        queue: EditQueue,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, editor, items, details, queue, clock, logger }) {
        return { readOptions, merge };

        /**
         * Reads the merge options of a pull request fresh (`PullRequestMergeOptions`), and writes the status read
         * with them into its row and its detail: the head commit the next merge names among it. `null` when it is no pull request GitHub shows the user, when GitHub could not be
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

            if (options) {
                // As stored: a change of the user's still on its way must not become part of it.
                const { status } = options;
                const stored = items.getStored(itemId);
                if (stored?.kind === 'pullRequest') {
                    items.upsertMany([{ ...stored, ...status }]);
                }

                // Opened from outside the lists, it has no row: its detail is what the panel shows.
                details.update(itemId, detail =>
                    detail.item.kind === 'pullRequest' ? { ...detail, item: { ...detail.item, ...status } } : detail,
                );
            }

            return options;
        }

        /**
         * Merges the pull request as shown, with its head commit. Resolves once GitHub took the merge
         * (`accepted`: it runs on, drawn as being merged) or refused it at once (`refused`); a refusal is the panel's
         * to show, and reported like a failed edit only when the panel does not show the pull request
         * ({@link MergeParams.shown}). Refused as not allowed without being sent when the user may not
         * merge it, or it is being merged already.
         */
        async function merge(params: MergeParams): Promise<MergeAnswer> {
            const { item, request, shown, onLateEnd } = params;
            const account = accounts.current;
            const merging = queue.pending.some(edit => edit.itemId === item.id && edit.subject.kind === 'merged');
            if (!account || merging || !editor.getPermissions(item).merge) {
                return { kind: 'refused', reason: { kind: 'notAllowed' } };
            }

            const answered = createPromise<MergeAnswer>();
            const edit = createMergeEdit({ item, request, clock, shown, onAnswer: answered.resolve, onLateEnd });
            void queue.submit({ edits: [edit], account, itemCount: 1 }).finally(() => {
                // Never sent: another account signed in, or none, meanwhile. Settled already otherwise.
                answered.resolve({ kind: 'refused', reason: { kind: 'notAllowed' } });
            });
            return await answered.promise;
        }
    },
});
