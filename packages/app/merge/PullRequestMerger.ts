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
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import { readStacksWhole } from '@/sync/readStacksWhole.js';
import { pause } from '@/utils/pause.js';

import { createMergeEdits } from './createMergeEdits.js';
import { createRevertEdit } from './createRevertEdit.js';
import type { MergeAnswer, MergeLateEnd, MergeOptions, MergeRequest, RevertedPullRequest } from './MergeTypes.js';
import { toMergeOptions } from './toMergeOptions.js';

/** The first wait before reading again whether an update of the branch landed; each next one doubles. */
const FIRST_UPDATE_READ_MS = 1000;
/** How long an update of the branch is waited for before what GitHub says goes. */
const UPDATE_TIME_LIMIT_MS = 30_000;

/** What {@link PullRequestMerger}'s `readUntilNewHead` waits for. */
export interface ReadUntilNewHeadParams {
    readonly itemId: string;
    /** The head commit the update was asked for. */
    readonly head: string;
    /** Reads the pull request: its merge options unless whoever waits has its own read to keep current. */
    readonly read?: () => Promise<unknown>;
}

/** A merge {@link PullRequestMerger} sends. */
export interface MergeParams {
    /** The pull request as shown: its head commit is the one the merge names. */
    readonly item: PullRequestItem;
    /** The open pull requests of its stack before it, which the merge lands with it (stacked PRs D11). */
    readonly members?: readonly PullRequestItem[];
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
        return { readOptions, merge, readStack, readUntilNewHead, revert };

        /**
         * GitHub answers an update of the branch before it is made: the old head, its mergeability unknown (live,
         * 2026-11-02). Merging that head would be refused as a new commit, so the pull request is read again, waiting longer
         * each time, until the head moved or the time is up: then what GitHub says goes.
         */
        async function readUntilNewHead(params: ReadUntilNewHeadParams) {
            const { itemId, head, read = () => readOptions(itemId) } = params;
            const deadline = clock.now() + UPDATE_TIME_LIMIT_MS;
            let delay = FIRST_UPDATE_READ_MS;
            while (getHead(itemId) === head && clock.now() < deadline) {
                await pause(clock, Math.min(delay, deadline - clock.now()));
                delay *= 2;
                await read();
            }
        }

        function getHead(itemId: string) {
            const item = details.getItem(itemId);
            return item?.kind === 'pullRequest' ? item.headRefOid : undefined;
        }

        /**
         * Opens the pull request reverting a merged one, as an edit with its failure toast: nothing shows until GitHub made
         * it. Resolves with it; `null` when it wasn't made, the user may not, or the account changed meanwhile.
         */
        async function revert(item: PullRequestItem): Promise<RevertedPullRequest | null> {
            const account = accounts.current;
            if (!account || !editor.getPermissions(item).revert) {
                return null;
            }

            let opened: RevertedPullRequest | null = null;
            await queue.submit({
                edits: [
                    createRevertEdit(item, pr => {
                        opened = pr;
                    }),
                ],
                account,
                itemCount: 1,
            });
            return accounts.isCurrent(account) ? opened : null;
        }

        /**
         * Reads the merge options of a pull request fresh (`PullRequestMergeOptions`), and writes the status read
         * with them into its row and its detail: the head commit the next merge names among it. `null` when it
         * is no pull request GitHub shows the user, when GitHub could not be asked, or when the account changed
         * meanwhile. Never rejects.
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
         * (`accepted`: it runs on, drawn as being merged), said it merged at once (`merged`: merged already, PM30) or
         * refused it at once (`refused`); a refusal is the panel's
         * to show, and reported like a failed edit only when the panel does not show the pull request
         * ({@link MergeParams.shown}). Refused as not allowed without being sent when the user may not
         * merge it, or it is being merged already (its permissions say so).
         */
        async function merge(params: MergeParams): Promise<MergeAnswer> {
            const { item, members = [], request, shown, onLateEnd } = params;
            const account = accounts.current;
            if (!account || !editor.getPermissions(item).merge) {
                return { kind: 'refused', reason: { kind: 'notAllowed' } };
            }

            const answered = createPromise<MergeAnswer>();
            const edits = createMergeEdits({
                item,
                members,
                request,
                clock,
                shown,
                onAnswer: answered.resolve,
                onLateEnd,
                readQueued: () => readQueued(item),
            });
            // One merge is one thing that can fail, however many pull requests it lands (a stack's, D11).
            void queue.submit({ edits, account, itemCount: 1 }).finally(() => {
                // Never sent: another account signed in, or none, meanwhile. Settled already otherwise.
                answered.resolve({ kind: 'refused', reason: { kind: 'notAllowed' } });
            });
            return await answered.promise;
        }

        /** What GitHub holds of a pull request it put in the merge queue, with its stack's when in one. */
        async function readQueued(item: PullRequestItem) {
            await (item.stack ? readStack(item.stack.id, item.stack.size) : readOptions(item.id));
        }

        /**
         * Reads a stack whole again (`PullRequestStacks`) — after a merge of it that did not end merged, what landed is
         * only what GitHub holds (stacked PRs D11) — and writes its pull requests into the copy. Resolves whether it
         * was: not when GitHub could not be asked, or the account changed meanwhile. Never rejects.
         */
        async function readStack(stackId: string, size: number): Promise<boolean> {
            const account = accounts.current;
            if (!account) {
                return false;
            }

            let read: Item[];
            try {
                read = await readStacksWhole({
                    sdk: account.sdk,
                    stacks: [{ id: stackId, size }],
                    items,
                    logger,
                });
            } catch (error) {
                logger.warn('The stack was not read again', { stackId, error });
                return false;
            }

            if (!accounts.isCurrent(account)) {
                return false;
            }

            items.upsertMany(read);
            return true;
        }
    },
});
