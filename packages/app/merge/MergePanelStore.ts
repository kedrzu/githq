import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { EditFailureReason } from '@/edits/EditTypes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

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

/**
 * The merge panel (merging D7, D11): the one pull request it is open for, over any screen, and the merges sent
 * from it. Opening it again, for the same pull request or another, starts a fresh panel. What the session knows of
 * a merge that did not end merged — refused, refused for a moved head or a method the rules don't allow, no answer
 * in time — stays per pull request ({@link MergeRecord}, D15) until the next merge of it is sent, in memory only,
 * and goes when another account signs in, or none.
 */
export type MergePanelStore = Resolved<typeof MergePanelStore>;
export const MergePanelStore = defineService({
    name: 'MergePanelStore',
    deps: { merger: PullRequestMerger, accounts: AccountSession },
    setup({ merger, accounts }) {
        const itemIdRef = shallowRef<string | null>(null);
        const openingRef = shallowRef(0);
        const recordsRef = shallowRef<ReadonlyMap<string, MergeRecord>>(new Map());
        let onSent: (() => void) | undefined;

        accounts.onChange(() => {
            recordsRef.value = new Map();
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
            open,
            close,
            merge,
            getRecord,
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

        /** What this session knows of the pull request's last merge that did not end merged; `null` for none. Reactive. */
        function getRecord(itemId: string): MergeRecord | null {
            return recordsRef.value.get(itemId) ?? null;
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

            const answer = await merger.merge({
                item,
                request: submission.request,
                shown,
                onLateEnd: end =>
                    end.kind === 'unknown'
                        ? keep({ kind: 'unknown', sent })
                        : void recordRefusal(end.reason, () => merger.readOptions(item.id)),
            });
            if (answer.kind === 'accepted') {
                if (shown()) {
                    const sentFrom = onSent;
                    close();
                    sentFrom?.();
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
                if (account && accounts.isCurrent(account)) {
                    recordsRef.value = new Map(recordsRef.value).set(item.id, record);
                }
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
