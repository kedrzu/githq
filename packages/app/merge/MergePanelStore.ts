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
import type {
    MergeAnswer,
    MergeHeadCommit,
    MergeRecord,
    MergeRefusedRecord,
    MergeSubmission,
    RevertedPullRequest,
    SentMerge,
} from './MergeTypes.js';
import { PullRequestMerger } from './PullRequestMerger.js';
import { sendsMergeMethod } from './sendsMergeMethod.js';

/** The loops of the regular sync that read pull requests again: a round of one says how a merge ended (D3). */
const READING_LOOPS: readonly SyncLoop[] = ['myWork', 'pullRequestStatuses', 'repositories'];

/** How the merge panel is opened. */
export interface MergePanelOpenOptions {
    /**
     * Runs once GitHub accepted a merge sent from this opening, as the panel leaves (PM32a): a list moves on to its
     * next row. Not run when the panel was closed, or opened anew, before GitHub answered. Given the pull requests the
     * merge took: one, or every one going of a stack's.
     */
    readonly onSent?: (merged: readonly string[]) => void;
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

/** A pull request a revert opened, for its toast. */
export interface MergeRevert {
    readonly id: number;
    /** The reverted pull request's `owner/name#number`. */
    readonly reference: string;
    readonly opened: RevertedPullRequest;
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
 * goes (PM34), as is the pull request a revert opened. Open for a pull request in a stack, the panel is the stack's (stacked PRs D11): a merge of two or more
 * is recorded as any merge, under the top of the range, with every one going ({@link SentMerge.going}) — refused, the
 * stack is read again whole, what landed being what the copy then holds, and until that read succeeds it is not known;
 * the top's head commit is read with it, to name a push to it (PM27). The method it was sent with stays under every
 * one going, the panel's own pull request being the first of them.
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
        const openingRef = shallowRef(0);
        const recordsRef = shallowRef<ReadonlyMap<string, MergeRecord>>(new Map());
        const sentRef = shallowRef<ReadonlyMap<string, SentMerge>>(new Map());
        const confirmationsRef = shallowRef<readonly MergeConfirmation[]>([]);
        const revertsRef = shallowRef<readonly MergeRevert[]>([]);
        let onSent: MergePanelOpenOptions['onSent'];
        let nextConfirmationId = 1;

        accounts.onChange(() => {
            recordsRef.value = new Map();
            sentRef.value = new Map();
            confirmationsRef.value = [];
            revertsRef.value = [];
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
            /** The pull requests reverts opened, oldest first, until dismissed. Reactive. */
            get reverts() {
                return revertsRef.value;
            },
            /** The pull requests whose last merge GitHub has not said the end of, oldest first. Reactive. */
            get unanswered(): readonly string[] {
                return [...recordsRef.value.keys()].filter(isUnanswered);
            },
            open,
            close,
            merge,
            getRecord,
            findRecordHolder,
            isOutcomeUnknown,
            getSent,
            noteHeadCommit,
            forget,
            dismissConfirmation,
            noteRevert,
            dismissRevert,
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

        /** Closes the panel. */
        function close() {
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

        /**
         * The pull request whose record speaks for this one: itself, sent alone or as the top of a range, else the top of
         * a stack's merge of two or more that took it, whichever member the panel is open on now; `null` for none.
         * Reactive.
         */
        function findRecordHolder(itemId: string): string | null {
            if (recordsRef.value.has(itemId)) {
                return itemId;
            }

            for (const [topId, record] of recordsRef.value) {
                if (record.sent.going?.includes(itemId)) {
                    return topId;
                }
            }

            return null;
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

        function dismissConfirmation(id: number) {
            confirmationsRef.value = confirmationsRef.value.filter(confirmation => confirmation.id !== id);
        }

        /** A pull request a revert opened: said in a toast leading to it. */
        function noteRevert(revert: Omit<MergeRevert, 'id'>) {
            revertsRef.value = [...revertsRef.value, { ...revert, id: nextConfirmationId++ }];
        }

        function dismissRevert(id: number) {
            revertsRef.value = revertsRef.value.filter(revert => revert.id !== id);
        }

        /** A merge that took the pull request has no known end yet, a stack's held under its top too (PM29). Reactive. */
        function isOutcomeUnknown(itemId: string) {
            const holder = findRecordHolder(itemId);
            return holder !== null && isUnanswered(holder);
        }

        function isUnanswered(itemId: string) {
            const pr = details.getItem(itemId);
            const end = pr?.kind === 'pullRequest' ? getMergeEnd(getRecord(itemId), pr, null) : null;
            return end?.kind === 'unknown' && !end.refusal;
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
         * of two or more takes every one going with it, recorded under the top: refused, the stack is read again whole
         * (stacked PRs D11).
         */
        async function merge(params: MergePanelMergeParams): Promise<MergeAnswer> {
            const { item, submission, stack } = params;
            const opening = openingRef.value;
            const account = accounts.current;
            const going = stack?.going.map(pr => pr.id);
            const sent: SentMerge = {
                ...submission,
                head: item.headRefOid,
                ...(going ? { going } : {}),
                ...(sendsMergeMethod(stack?.going[0] ?? item, submission.request) ? {} : { withoutMethod: true }),
            };
            // The next merge of it ends what is known of the last, a stack's that took it included.
            const last = findRecordHolder(item.id);
            forget(item.id, ...(going ?? []), ...(last === null ? [] : [last]));

            const answer = await merger.merge({
                item,
                members: stack?.going.filter(pr => pr.id !== item.id),
                request: submission.request,
                shown: isShown,
                onLateEnd: end => {
                    switch (end.kind) {
                        case 'merged':
                            confirm();
                            // What the follow-ups go by: GitHub lets the branch go only now, or deleted it itself (PM26b).
                            void merger.readOptions(item.id);
                            return;
                        case 'unknown':
                            keep({ kind: 'unknown', sent, at: clock.now(), accepted: true });
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
                    if (openingRef.value === opening && isShown()) {
                        const sentFrom = onSent;
                        close();
                        sentFrom?.(going ?? [item.id]);
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
             * refusal says what landed only from the stack read again whole (stacked PRs D11): not known until then.
             */
            function keep(record: MergeRecord) {
                if (!isSender()) {
                    return;
                }

                const sentOf = new Map(sentRef.value);
                for (const itemId of going ?? [item.id]) {
                    sentOf.set(itemId, sent);
                }

                sentRef.value = sentOf;
                if (!stack || record.kind !== 'refused') {
                    setRecord(record);
                    return;
                }

                const reading: MergeRecord = {
                    kind: 'unknown',
                    sent,
                    at: record.at,
                    accepted: false,
                    refusal: record.reason,
                };
                setRecord(reading);
                void readAgain(stack, reading, record);
            }

            /**
             * The refusal speaks once the stack is read, unless something newer of the merge came meanwhile — naming the
             * top's head commit, which the panel's read, the first open one's, does not (PM27).
             */
            async function readAgain(merged: MergePanelStackMerge, reading: MergeRecord, refused: MergeRefusedRecord) {
                const [read, options] = await Promise.all([
                    merger.readStack(merged.id, merged.size),
                    merger.readOptions(item.id),
                ]);
                if (read && recordsRef.value.get(item.id) === reading) {
                    const headCommit = options?.headCommit;
                    setRecord(headCommit ? { ...refused, headCommit } : refused);
                }
            }

            function setRecord(record: MergeRecord) {
                recordsRef.value = new Map(recordsRef.value).set(item.id, record);
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
