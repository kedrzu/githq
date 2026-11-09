import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef, watch } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';

import type { EditFailureReason } from './EditTypes.js';

/** A comment GitHub did not take: it stays in the item's thread until it is posted or discarded. */
export interface FailedComment {
    readonly id: number;
    readonly itemId: string;
    readonly body: string;
    /** Why GitHub did not take it, the last time it was sent. */
    readonly reason: EditFailureReason;
    /** Sent again and not answered yet: the thread shows it as on its way, not as failed. */
    readonly retrying: boolean;
}

/**
 * What the user wrote and GitHub does not have: what is typed into each item's comment box and not posted, by item
 * id, and every comment GitHub did not take — never lost (D8), kept until it is posted or discarded. In memory only,
 * and only for the user signed in.
 */
export type CommentDrafts = Resolved<typeof CommentDrafts>;
export const CommentDrafts = defineService({
    name: 'CommentDrafts',
    deps: {
        auth: AuthStore,
    },
    setup({ auth }) {
        const draftsRef = shallowRef<ReadonlyMap<string, string>>(new Map());
        const failedRef = shallowRef<readonly FailedComment[]>([]);
        let nextFailed = 1;

        watch(
            () => auth.viewer?.login,
            () => {
                draftsRef.value = new Map();
                failedRef.value = [];
            },
            { flush: 'sync' },
        );

        return {
            /** Whether any comment is typed and not posted, or was not taken by GitHub; reactive. */
            get hasAny() {
                return draftsRef.value.size > 0 || failedRef.value.length > 0;
            },
            get,
            set,
            getFailed,
            addFailed,
            retryFailed,
            settleFailed,
            discardFailed,
        };

        /** The item's draft; empty without one. Reactive. */
        function get(itemId: string): string {
            return draftsRef.value.get(itemId) ?? '';
        }

        function set(itemId: string, text: string) {
            const next = new Map(draftsRef.value);
            if (text) {
                next.set(itemId, text);
            } else {
                next.delete(itemId);
            }

            draftsRef.value = next;
        }

        /** The item's comments GitHub did not take and not sent again, in the order they were written; reactive. */
        function getFailed(itemId: string): FailedComment[] {
            return failedRef.value.filter(comment => comment.itemId === itemId && !comment.retrying);
        }

        function addFailed(itemId: string, body: string, reason: EditFailureReason) {
            failedRef.value = [...failedRef.value, { id: nextFailed++, itemId, body, reason, retrying: false }];
        }

        /** Marks the comment as sent again and returns it; `null` when it is gone or already on its way. */
        function retryFailed(id: number): FailedComment | null {
            const comment = failedRef.value.find(candidate => candidate.id === id);
            if (!comment || comment.retrying) {
                return null;
            }

            update(id, { ...comment, retrying: true });
            return comment;
        }

        /**
         * Ends a retry: posted (`reason` `null`), the comment goes — GitHub's takes its place; not, it is back where it
         * was, with why.
         */
        function settleFailed(id: number, reason: EditFailureReason | null) {
            if (reason === null) {
                discardFailed(id);
                return;
            }

            const comment = failedRef.value.find(candidate => candidate.id === id);
            if (comment) {
                update(id, { ...comment, reason, retrying: false });
            }
        }

        function discardFailed(id: number) {
            failedRef.value = failedRef.value.filter(comment => comment.id !== id);
        }

        function update(id: number, comment: FailedComment) {
            failedRef.value = failedRef.value.map(candidate => (candidate.id === id ? comment : candidate));
        }
    },
});
