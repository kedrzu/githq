import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { shallowRef, watch } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { EditFailureReason } from '@/edits/EditTypes.js';
import { Clock } from '@/services/Clock.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { SyncLoop } from '@/store/ItemStoreTypes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import { getMergeEnd } from './getMergeEnd.js';
import type { MergeAnswer, MergeRecord, MergeSubmission, SentMerge } from './MergeTypes.js';
import { PullRequestMerger } from './PullRequestMerger.js';

/** The loops of the regular sync that read pull requests again: a round of one says how a merge ended (D3). */
const READING_LOOPS: readonly SyncLoop[] = ['myWork', 'pullRequestStatuses', 'repositories'];

/** How the merge panel is opened. */
export interface MergePanelOpenOptions {
    /**
     * Runs once GitHub accepted a merge sent from this opening, as the panel leaves (PM32a): a list moves on to its
     * next row. Not run when the panel was closed, or opened anew, before GitHub answered.
     */
    readonly onSent?: () => void;
}

/** A merge {@link MergePanelStore} sends from the panel. */
export interface MergePanelMergeParams {
    /** The pull request as shown: its head commit is the one the merge names. */
    readonly item: PullRequestItem;
    readonly submission: MergeSubmission;
}

/** A merge GitHub confirmed while the merge panel did not show its pull request, for its toast (PM34). */
export interface MergeConfirmation {
    readonly id: number;
    readonly itemId: string;
    /** The pull request's `owner/name#number`. */
    readonly reference: string;
    /** The branch it was merged into. */
    readonly base: string;
}

/**
 * The merge panel (merging D7, D11): the one pull request it is open for, over any screen, and the merges sent
 * from it. Opening it again, for the same pull request or another, starts a fresh panel. What the session knows of
 * a merge that did not end merged — refused, or no answer — is recorded per pull request as GitHub answers
 * ({@link MergeRecord}, D15), in memory only, and goes when another account signs in, or none. It speaks for the pull
 * request until the next merge of it is sent, the panel takes a step towards the merge itself, or a copy of it read
 * since arrives — its detail read again, or a round of the regular sync — which says what GitHub holds (D3, PM36);
 * the panel's own reads don't (PM29). The method and text it was sent with stay for the session, for the panel to
 * start on again (D15). A merge confirmed while the panel did not show it is listed for its toast until the toast
 * goes (PM34).
 */
export type MergePanelStore = Resolved<typeof MergePanelStore>;
export const MergePanelStore = defineService({
    name: 'MergePanelStore',
    deps: {
        merger: PullRequestMerger,
        accounts: AccountSession,
        items: ItemStore,
        details: ItemDetailStore,
        clock: Clock,
    },
    setup({ merger, accounts, items, details, clock }) {
        const itemIdRef = shallowRef<string | null>(null);
        const openingRef = shallowRef(0);
        const recordsRef = shallowRef<ReadonlyMap<string, MergeRecord>>(new Map());
        const sentRef = shallowRef<ReadonlyMap<string, SentMerge>>(new Map());
        const confirmationsRef = shallowRef<readonly MergeConfirmation[]>([]);
        let onSent: (() => void) | undefined;
        let nextConfirmationId = 1;

        accounts.onChange(() => {
            recordsRef.value = new Map();
            sentRef.value = new Map();
            confirmationsRef.value = [];
        });

        // A copy read since the answer says what GitHub holds: the record no longer speaks for the pull request. Ended
        // as the copy arrives, so a sync failing later does not bring it back.
        watch(
            () => [...recordsRef.value].filter(([itemId, record]) => isReadSince(itemId, record.at)),
            read => forget(...read.map(([itemId]) => itemId)),
            { flush: 'sync' },
        );

        return {
            /** The pull request the panel is open for; `null` while it is closed. Reactive. */
            get itemId() {
                return itemIdRef.value;
            },
            /** Counts the openings: each starts a fresh panel, with nothing of the one before. Reactive. */
            get opening() {
                return openingRef.value;
            },
            /** The merges confirmed while the panel did not show them, oldest first, until dismissed. Reactive. */
            get confirmations() {
                return confirmationsRef.value;
            },
            /** The pull requests whose last merge GitHub has not said the end of, oldest first. Reactive. */
            get unanswered(): readonly string[] {
                return [...recordsRef.value.keys()].filter(isUnanswered);
            },
            open,
            close,
            merge,
            getRecord,
            getSent,
            forget,
            dismissConfirmation,
        };

        /** Opens the panel for a pull request, in place of whatever it was open for. */
        function open(itemId: string, options: MergePanelOpenOptions = {}) {
            itemIdRef.value = itemId;
            openingRef.value++;
            onSent = options.onSent;
        }

        function close() {
            itemIdRef.value = null;
            onSent = undefined;
        }

        /**
         * What this session knows of the pull request's last merge that did not end merged, while it still speaks for
         * it; `null` for none. How it reads is told from the pull request as it is ({@link getMergeEnd}). Reactive.
         */
        function getRecord(itemId: string): MergeRecord | null {
            return recordsRef.value.get(itemId) ?? null;
        }

        /** The method and text the pull request's last merge that did not end merged was sent with, for the session. */
        function getSent(itemId: string): SentMerge | null {
            return sentRef.value.get(itemId) ?? null;
        }

        /**
         * Ends what the records of the pull requests say — the method and text sent stay: the panel took a step
         * towards the merge itself, whose new head is no news of the merge (PM20, PM21).
         */
        function forget(...itemIds: string[]) {
            const records = new Map(recordsRef.value);
            const removed = itemIds.filter(itemId => records.delete(itemId));
            if (removed.length > 0) {
                recordsRef.value = records;
            }
        }

        function dismissConfirmation(id: number) {
            confirmationsRef.value = confirmationsRef.value.filter(confirmation => confirmation.id !== id);
        }

        function isUnanswered(itemId: string) {
            const pr = details.getItem(itemId);
            return pr?.kind === 'pullRequest' && getMergeEnd(getRecord(itemId), pr, null)?.kind === 'unknown';
        }

        /**
         * A copy of the pull request read after `at` arrived: its detail read again, or a round of the regular sync
         * that started since succeeded — it reads open pull requests each round. The panel's reads of the merge options
         * write its row too, but they are not it (D3, PM29).
         */
        function isReadSince(itemId: string, at: number) {
            const detail = details.get(itemId);
            if (detail !== undefined && detail.fetchedAt > at) {
                return true;
            }

            return READING_LOOPS.some(loop => {
                const state = items.getSyncState(loop);
                // A failure keeps the last success's time but not when its round started: only the latest round tells.
                return state.lastError === null && state.lastAttemptAt !== null && state.lastAttemptAt > at;
            });
        }

        /**
         * Sends the merge shown in the panel. Once GitHub accepts it, the panel leaves and the opener's `onSent`
         * runs; merged at once, as GitHub answers for one merged already (PM30), or refused at once, the panel stays
         * and shows it — a refusal recorded as it arrives ({@link getRecord}). A refusal arriving after the panel
         * closed or opened anew is reported like a failed edit as well ({@link PullRequestMerger}).
         */
        async function merge(params: MergePanelMergeParams): Promise<MergeAnswer> {
            const { item, submission } = params;
            const opening = openingRef.value;
            const account = accounts.current;
            const sent: SentMerge = { ...submission, head: item.headRefOid };
            forget(item.id);

            const answer = await merger.merge({
                item,
                request: submission.request,
                shown: () => itemIdRef.value === item.id,
                onLateEnd: end => {
                    switch (end.kind) {
                        case 'merged':
                            confirm();
                            return;
                        case 'unknown':
                            keep({ kind: 'unknown', sent, at: clock.now() });
                            return;
                        case 'refused':
                            keep(toRecord(end.reason));
                            return;
                        default:
                            assertNever(end);
                    }
                },
            });
            switch (answer.kind) {
                case 'accepted':
                    if (openingRef.value === opening && itemIdRef.value === item.id) {
                        const sentFrom = onSent;
                        close();
                        sentFrom?.();
                    }

                    return answer;
                case 'merged':
                    return answer;
                case 'refused':
                    keep(toRecord(answer.reason));
                    return answer;
                default:
                    return assertNever(answer);
            }

            /** Unanswered, it may have reached GitHub all the same: neither merged nor refused. */
            function toRecord(reason: EditFailureReason): MergeRecord {
                const at = clock.now();
                return reason.kind === 'offline'
                    ? { kind: 'unknown', sent, at }
                    : { kind: 'refused', sent, reason, at };
            }

            /** Recorded while the account that sent it is still signed in: another one's records start empty. */
            function keep(record: MergeRecord) {
                if (isSender()) {
                    recordsRef.value = new Map(recordsRef.value).set(item.id, record);
                    sentRef.value = new Map(sentRef.value).set(item.id, sent);
                }
            }

            /** Merged: said in a toast unless the panel shows it (PM34). */
            function confirm() {
                if (isSender() && itemIdRef.value !== item.id) {
                    const reference = `${item.repository.nameWithOwner}#${item.number}`;
                    const confirmation = {
                        id: nextConfirmationId++,
                        itemId: item.id,
                        reference,
                        base: item.baseRefName,
                    };
                    confirmationsRef.value = [...confirmationsRef.value, confirmation];
                }
            }

            function isSender() {
                return account !== null && accounts.isCurrent(account);
            }
        }
    },
});
