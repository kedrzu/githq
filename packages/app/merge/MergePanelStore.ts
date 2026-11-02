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
import type { MergeAnswer, MergeHeadCommit, MergeRecord, MergeSubmission, SentMerge } from './MergeTypes.js';
import { PullRequestMerger } from './PullRequestMerger.js';
import type { SentStackMerge, StackMergeRecord, StackMergeRefusal } from './stack/StackMergeTypes.js';

/** The loops of the regular sync that read pull requests again: a round of one says how a merge ended (D3). */
const READING_LOOPS: readonly SyncLoop[] = ['myWork', 'pullRequestStatuses', 'repositories'];

/** How the merge panel is opened. */
export interface MergePanelOpenOptions {
    /**
     * Runs once GitHub accepted a merge sent from this opening, as the panel leaves (PM32a): a list moves on to its
     * next row. Not run when the panel was closed, or opened anew, before GitHub answered.
     */
    readonly onSent?: () => void;
    /**
     * Opened from a stack's entry: the panel takes the whole stack, whichever of its pull requests `itemId` names.
     * Opened on a pull request in a stack, it takes everything up to it (stacked PRs D11) — any one may open it.
     */
    readonly wholeStack?: boolean;
}

/** The stack the merge panel is open for (stacked PRs D11). */
export interface MergePanelStack {
    /** The stack's node id. */
    readonly id: string;
    /** The number of the pull request it was opened on; `null` from the stack's entry. */
    readonly openedOn: number | null;
}

/** A merge {@link MergePanelStore} sends from the panel. */
export interface MergePanelMergeParams {
    /** The pull request as shown: its head commit is the one the merge names — a stack's, the top of the range. */
    readonly item: PullRequestItem;
    readonly submission: MergeSubmission;
    /** A stack's merge of two or more; none for one pull request (a stack's first open one alone included, D18). */
    readonly stack?: MergePanelStackMerge;
}

/** A stack's merge of two or more, one merge of the top of the range landing every one going (stacked PRs D11). */
export interface MergePanelStackMerge {
    /** The stack's node id. */
    readonly id: string;
    /** How many pull requests the stack holds: it is read whole again after a merge that did not end merged. */
    readonly size: number;
    /** Every open pull request going, first to last, the merge's `item` last. */
    readonly going: readonly PullRequestItem[];
}

/** A merge GitHub confirmed while the merge panel did not show its pull request, for its toast (PM34). */
export interface MergeConfirmation {
    readonly id: number;
    readonly itemId: string;
    /** The pull request's `owner/name#number`. */
    readonly reference: string;
    /** The branch it was merged into. */
    readonly base: string;
    /** A stack's merge of two or more: how many landed, and where (SP8). None for one pull request. */
    readonly stack?: MergeConfirmationStack;
}

/** A stack's merge of two or more, as its toast says it. */
export interface MergeConfirmationStack {
    /** The repository's `owner/name`. */
    readonly repository: string;
    /** How many pull requests landed with the merge. */
    readonly count: number;
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
 * goes (PM34). Open for a pull request in a stack, the panel is the stack's (stacked PRs D11): a merge of two or more
 * is recorded for the stack ({@link StackMergeRecord}) — refused, the stack is read again whole, and what landed is
 * what the copy then holds — until a panel showing it closes, or the next merge of the stack is sent.
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
        const stackRef = shallowRef<MergePanelStack | null>(null);
        const stackRecordsRef = shallowRef<ReadonlyMap<string, StackMergeRecord>>(new Map());
        const openingRef = shallowRef(0);
        const recordsRef = shallowRef<ReadonlyMap<string, MergeRecord>>(new Map());
        const sentRef = shallowRef<ReadonlyMap<string, SentMerge>>(new Map());
        const confirmationsRef = shallowRef<readonly MergeConfirmation[]>([]);
        let onSent: (() => void) | undefined;
        let nextConfirmationId = 1;

        accounts.onChange(() => {
            recordsRef.value = new Map();
            stackRecordsRef.value = new Map();
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
            /** The stack the panel is open for; `null` while it is closed, or open for one outside any stack. Reactive. */
            get stack() {
                return stackRef.value;
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
            getStackRecord,
            getSent,
            noteHeadCommit,
            forget,
            dismissConfirmation,
        };

        /** Opens the panel for a pull request — or its stack — in place of whatever it was open for. */
        function open(itemId: string, options: MergePanelOpenOptions = {}) {
            const item = details.getItem(itemId);
            const pr = item?.kind === 'pullRequest' ? item : null;
            itemIdRef.value = itemId;
            stackRef.value = pr?.stack ? { id: pr.stack.id, openedOn: options.wholeStack ? null : pr.number } : null;
            openingRef.value++;
            onSent = options.onSent;
        }

        /** Closes the panel. What it said of the stack's last merge is said: the record goes, once settled. */
        function close() {
            const stackId = stackRef.value?.id;
            const record = stackId === undefined ? undefined : stackRecordsRef.value.get(stackId);
            if (stackId !== undefined && record && !(record.kind === 'refused' && record.partway && !record.read)) {
                setStackRecord(stackId, null);
            }

            itemIdRef.value = null;
            stackRef.value = null;
            onSent = undefined;
        }

        /**
         * What this session knows of the pull request's last merge that did not end merged, while it still speaks for
         * it; `null` for none. How it reads is told from the pull request as it is ({@link getMergeEnd}). Reactive.
         */
        function getRecord(itemId: string): MergeRecord | null {
            return recordsRef.value.get(itemId) ?? null;
        }

        /** What this session knows of the stack's last merge of two or more that did not end merged; reactive. */
        function getStackRecord(stackId: string): StackMergeRecord | null {
            return stackRecordsRef.value.get(stackId) ?? null;
        }

        /** The method and text the pull request's last merge that did not end merged was sent with, for the session. */
        function getSent(itemId: string): SentMerge | null {
            return sentRef.value.get(itemId) ?? null;
        }

        /**
         * Notes on a refusal still speaking for the pull request the head commit a read after it brought, while that is
         * its head: the rows and the opened item, which read no merge options, then say who pushed it (PM27, PM37).
         */
        function noteHeadCommit(itemId: string, commit: MergeHeadCommit) {
            const record = getRecord(itemId);
            const pr = details.getItem(itemId);
            if (record?.kind === 'refused' && pr?.kind === 'pullRequest' && pr.headRefOid === commit.oid) {
                recordsRef.value = new Map(recordsRef.value).set(itemId, { ...record, headCommit: commit });
            }
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

        function setStackRecord(stackId: string, record: StackMergeRecord | null) {
            const records = new Map(stackRecordsRef.value);
            if (record) {
                records.set(stackId, record);
            } else {
                records.delete(stackId);
            }

            stackRecordsRef.value = records;
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
         * closed or opened anew is reported like a failed edit as well ({@link PullRequestMerger}). A stack's merge
         * of two or more takes every one going with it, and its end is recorded for the stack too: refused, the stack
         * is read again whole (stacked PRs D11).
         */
        async function merge(params: MergePanelMergeParams): Promise<MergeAnswer> {
            const { item, submission, stack } = params;
            const opening = openingRef.value;
            const account = accounts.current;
            const sent: SentMerge = { ...submission, head: item.headRefOid };
            const sentStack: SentStackMerge | null = stack
                ? {
                      method: submission.request.method,
                      going: stack.going.map(pr => ({ itemId: pr.id, number: pr.number, head: pr.headRefOid })),
                  }
                : null;
            forget(item.id);
            if (stack) {
                setStackRecord(stack.id, null);
            }

            const answer = await merger.merge({
                item,
                members: stack?.going.filter(pr => pr.id !== item.id),
                request: submission.request,
                shown: isShown,
                onLateEnd: end => {
                    switch (end.kind) {
                        case 'merged':
                            confirm();
                            return;
                        case 'unknown':
                            keep({ kind: 'unknown', sent, at: clock.now(), accepted: true });
                            return;
                        case 'refused':
                            keep(toRecord(end.reason), true);
                            return;
                        default:
                            assertNever(end);
                    }
                },
            });
            switch (answer.kind) {
                case 'accepted':
                    if (openingRef.value === opening && isShown()) {
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
                    ? { kind: 'unknown', sent, at, accepted: false }
                    : { kind: 'refused', sent, reason, at };
            }

            /**
             * Recorded while the account that sent it is still signed in: another one's records start empty. A stack's
             * refusal is recorded for it as well, and the stack read again whole: what landed is what GitHub holds.
             */
            function keep(record: MergeRecord, partway = false) {
                if (!isSender()) {
                    return;
                }

                recordsRef.value = new Map(recordsRef.value).set(item.id, record);
                sentRef.value = new Map(sentRef.value).set(item.id, sent);
                if (!stack || !sentStack) {
                    return;
                }

                if (record.kind === 'unknown') {
                    setStackRecord(stack.id, { kind: 'unknown', sent: sentStack, accepted: record.accepted });
                    return;
                }

                const refused: StackMergeRefusal = {
                    kind: 'refused',
                    sent: sentStack,
                    reason: record.reason,
                    partway,
                    read: false,
                };
                setStackRecord(stack.id, refused);
                void readAgain(stack, refused);
            }

            /**
             * The stack read again whole, the refusal then says what landed — or, GitHub not reached, the copy does
             * until the next sync. Unless another merge of it, or another account, came meanwhile.
             */
            async function readAgain(merged: MergePanelStackMerge, refused: StackMergeRefusal) {
                await merger.readStack(merged.id, merged.size);
                if (stackRecordsRef.value.get(merged.id) === refused) {
                    setStackRecord(merged.id, { ...refused, read: true });
                }
            }

            /**
             * The panel shows the pull request — open for a stack, its stack, whichever member it was opened on: it
             * sends the first open one alone (stacked PRs D18).
             */
            function isShown() {
                return stackRef.value ? stackRef.value.id === item.stack?.id : itemIdRef.value === item.id;
            }

            /** Merged: said in a toast unless the panel shows it (PM34) — a stack's, into its first one's base. */
            function confirm() {
                if (isSender() && !isShown()) {
                    const reference = `${item.repository.nameWithOwner}#${item.number}`;
                    const confirmation: MergeConfirmation = {
                        id: nextConfirmationId++,
                        itemId: item.id,
                        reference,
                        base: stack?.going[0]?.baseRefName ?? item.baseRefName,
                        ...(stack
                            ? { stack: { repository: item.repository.nameWithOwner, count: stack.going.length } }
                            : {}),
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
