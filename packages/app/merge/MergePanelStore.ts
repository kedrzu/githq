import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import type { PullRequestItem } from '@/store/ItemTypes.js';

import type { MergeAnswer, MergeRequest } from './MergeTypes.js';
import { PullRequestMerger } from './PullRequestMerger.js';

/** How the merge panel is opened. */
export interface MergePanelOpenOptions {
    /**
     * Runs once GitHub accepted a merge sent from this opening, as the panel leaves (PM32a): a list moves on to its
     * next row. Not run when the panel was closed, or opened anew, before GitHub answered.
     */
    readonly onSent?: () => void;
}

/**
 * The merge panel (merging D7, D11): the one pull request it is open for, over any screen, and the merges sent
 * from it. Opening it again, for the same pull request or another, starts a fresh panel; nothing of it is kept.
 */
export type MergePanelStore = Resolved<typeof MergePanelStore>;
export const MergePanelStore = defineService({
    name: 'MergePanelStore',
    deps: { merger: PullRequestMerger },
    setup({ merger }) {
        const itemIdRef = shallowRef<string | null>(null);
        const openingRef = shallowRef(0);
        let onSent: (() => void) | undefined;

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
         * Sends the merge shown in the panel. Once GitHub accepts it, the panel leaves and the opener's `onSent`
         * runs; refused at once, the panel stays and shows why (the answer). A refusal arriving after the panel
         * closed or opened anew is reported like a failed edit instead ({@link PullRequestMerger}).
         */
        async function merge(item: PullRequestItem, request: MergeRequest): Promise<MergeAnswer> {
            const opening = openingRef.value;
            const answer = await merger.merge({ item, request, shown });
            if (answer.kind === 'accepted' && shown()) {
                const sent = onSent;
                close();
                sent?.();
            }

            return answer;

            function shown() {
                return openingRef.value === opening && itemIdRef.value === item.id;
            }
        }
    },
});
