import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { EditFailureReason } from '@/edits/EditTypes.js';
import { Clock } from '@/services/Clock.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';

import { allowsMergeMethod } from './allowsMergeMethod.js';
import type { MergeAnswer, MergeOptions, MergeRecord, MergeSubmission, SentMerge } from './MergeTypes.js';
import { PullRequestMerger } from './PullRequestMerger.js';

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
    /**
     * Reads the merge options again after GitHub refused the merge while the panel shows it: the panel's own read, so
     * it shows what the refusal is told apart by. GitHub is asked directly otherwise.
     */
    readonly reread: () => Promise<MergeOptions | null>;
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

/** A record as the store keeps it: with the row it was made over and when, to tell a copy read since. */
interface KeptRecord {
    readonly record: MergeRecord;
    readonly row: Item | undefined;
    readonly at: number;
}

/**
 * The merge panel (merging D7, D11): the one pull request it is open for, over any screen, and the merges sent
 * from it. Opening it again, for the same pull request or another, starts a fresh panel. What the session knows of
 * a merge that did not end merged — refused, refused for a moved head or a method the rules don't allow, no answer
 * in time — stays per pull request ({@link MergeRecord}, D15) until the next merge of it is sent, in memory only,
 * and goes when another account signs in, or none; no answer in time goes too once a copy of the pull request read
 * since arrives, which says how it ended (D3, PM36). A merge confirmed while the panel did not show it is listed for
 * its toast until the toast goes (PM34).
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
        const recordsRef = shallowRef<ReadonlyMap<string, KeptRecord>>(new Map());
        const confirmationsRef = shallowRef<readonly MergeConfirmation[]>([]);
        let onSent: (() => void) | undefined;
        let nextConfirmationId = 1;

        accounts.onChange(() => {
            recordsRef.value = new Map();
            confirmationsRef.value = [];
        });

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
                return [...recordsRef.value.keys()].filter(id => getRecord(id)?.kind === 'unknown');
            },
            open,
            close,
            merge,
            getRecord,
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
         * What this session knows of the pull request's last merge that did not end merged; `null` for none, and for
         * no answer in time once a copy read since says how it ended. Reactive.
         */
        function getRecord(itemId: string): MergeRecord | null {
            const kept = recordsRef.value.get(itemId);
            return kept && !(kept.record.kind === 'unknown' && isReadSince(itemId, kept)) ? kept.record : null;
        }

        function dismissConfirmation(id: number) {
            confirmationsRef.value = confirmationsRef.value.filter(confirmation => confirmation.id !== id);
        }

        /**
         * A copy of the pull request read after the record was made arrived: its row replaced — the regular sync
         * reads open pull requests' statuses each round — or its detail read since. The panel's own reads of the
         * merge options write the row too, but say nothing of how the merge ended: only rows they did not write
         * count.
         */
        function isReadSince(itemId: string, kept: KeptRecord) {
            const detail = details.get(itemId);
            return !isRowKept(itemId, kept) || (detail !== undefined && detail.fetchedAt > kept.at);
        }

        /** Whether the row is the one the record was made over, or only the panel's reads wrote over it since. */
        function isRowKept(itemId: string, kept: KeptRecord) {
            let row = items.getStored(itemId);
            while (row !== kept.row) {
                row = row && merger.getReplacedRow(row);
                if (row === undefined) {
                    return false;
                }
            }

            return true;
        }

        /**
         * Sends the merge shown in the panel. Once GitHub accepts it, the panel leaves and the opener's `onSent`
         * runs; refused at once, the panel stays and shows why — resolved once the refusal is told apart and recorded
         * ({@link getRecord}). A refusal arriving after the panel closed or opened anew is reported like a failed edit
         * as well ({@link PullRequestMerger}).
         */
        async function merge(params: MergePanelMergeParams): Promise<MergeAnswer> {
            const { item, submission, reread } = params;
            const opening = openingRef.value;
            const account = accounts.current;
            const sent: SentMerge = { ...submission, head: item.headRefOid };
            if (recordsRef.value.has(item.id)) {
                const records = new Map(recordsRef.value);
                records.delete(item.id);
                recordsRef.value = records;
            }

            // Merged before the answer was taken in: the panel may be about to leave, so it is told after.
            let answered = false;
            let mergedMeanwhile = false;
            const answer = await merger.merge({
                item,
                request: submission.request,
                shown: () => itemIdRef.value === item.id,
                onLateEnd: end => {
                    switch (end.kind) {
                        case 'merged':
                            if (answered) {
                                confirm();
                            } else {
                                mergedMeanwhile = true;
                            }

                            return;
                        case 'unknown':
                            keep({ kind: 'unknown', sent });
                            return;
                        case 'refused':
                            void recordRefusal(end.reason, () => merger.readOptions(item.id));
                            return;
                        default:
                            assertNever(end);
                    }
                },
            });
            answered = true;
            if (answer.kind === 'accepted') {
                if (shown()) {
                    const sentFrom = onSent;
                    close();
                    sentFrom?.();
                }

                if (mergedMeanwhile) {
                    confirm();
                }

                return answer;
            }

            await recordRefusal(answer.reason, shown() ? reread : () => merger.readOptions(item.id));
            return answer;

            function shown() {
                return openingRef.value === opening && itemIdRef.value === item.id;
            }

            /**
             * A refusal, told apart by reading the pull request again (PM27, PM28): GitHub's words for it are not
             * documented. Only a refusal GitHub answered with is read again; one never sent, or unanswered, is what it
             * is.
             */
            async function recordRefusal(reason: EditFailureReason, read: () => Promise<MergeOptions | null>) {
                const options = reason.kind === 'refused' ? await read() : null;
                keep(toRefusalRecord(sent, reason, options));
            }

            /** Recorded while the account that sent it is still signed in: another one's records start empty. */
            function keep(record: MergeRecord) {
                if (isSender()) {
                    const kept: KeptRecord = { record, row: items.getStored(item.id), at: clock.now() };
                    recordsRef.value = new Map(recordsRef.value).set(item.id, kept);
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

/** A moved head first: whatever else GitHub held against the merge, it named a commit that is no longer the head. */
function toRefusalRecord(sent: SentMerge, reason: EditFailureReason, options: MergeOptions | null): MergeRecord {
    if (options && options.status.headRefOid !== sent.head) {
        return { kind: 'headMoved', sent, head: options.status.headRefOid, commit: options.headCommit };
    }

    if (options && !allowsMergeMethod(options, sent.request.method)) {
        return { kind: 'methodNotAllowed', sent };
    }

    return { kind: 'refused', sent, reason };
}
