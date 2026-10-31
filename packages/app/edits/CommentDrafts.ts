import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef, watch } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';

/**
 * What the user has typed into each item's comment box and not posted, by item id — and a comment GitHub did not
 * take, put back there: undoing a failed edit (D8) never loses what the user wrote. In memory only, and only for
 * the user signed in.
 */
export type CommentDrafts = Resolved<typeof CommentDrafts>;
export const CommentDrafts = defineService({
    name: 'CommentDrafts',
    deps: {
        auth: AuthStore,
    },
    setup({ auth }) {
        const draftsRef = shallowRef<ReadonlyMap<string, string>>(new Map());

        watch(
            () => auth.viewer?.login,
            () => {
                draftsRef.value = new Map();
            },
            { flush: 'sync' },
        );

        return { get, set, restore };

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

        /** Puts a comment that was not posted back into the item's box: alone, or after what is typed there now. */
        function restore(itemId: string, body: string) {
            const current = get(itemId);
            set(itemId, current.trim() ? `${current}\n\n${body}` : body);
        }
    },
});
