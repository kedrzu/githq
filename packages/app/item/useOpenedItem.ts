import { useLogger } from '@nzyme/vue-ioc/useLogger.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { computed, shallowRef, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { ReviewFiles } from '@/review/ReviewFiles.js';
import type { PullRequestFiles } from '@/review/ReviewFiles.js';
import type { ReviewThread } from '@/review/threads/ReviewThread.js';
import type { ReviewWriting } from '@/review/writing/ReviewWriting.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import type { ItemDetail } from '@/store/ItemDetailTypes.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item } from '@/store/ItemTypes.js';

import { ItemNavigation } from './ItemNavigation.js';
import { ItemResolver } from './ItemResolver.js';
import { formatItemReference, getItemReference } from './itemRoutes.js';
import type { ItemReference } from './itemRoutes.js';

/** Options of {@link useOpenedItem}. */
export interface UseOpenedItemOptions {
    /** The item an address names. */
    reference: MaybeRefOrGetter<ItemReference>;
}

/** An opened item and what is known of it so far. */
export interface OpenedItemViewModel {
    /** `null` until found; also `null` when there is no such item ({@link missing}). */
    readonly id: string | null;
    /** Its row: from the local copy at once, or read with its detail. */
    readonly item: Item | null;
    /** Body, comments, checks, every project field; `null` until read. */
    readonly detail: ItemDetail | null;
    /**
     * A pull request's review threads, code review's own (`ReviewFiles.openThreads`), with what is on its way to GitHub
     * drawn over them: read when it opens, not on every poll. Empty for an issue, and until read.
     */
    readonly reviewThreads: readonly ReviewThread[];
    /** Code review's writing of those threads and of the viewer's draft review; `null` for an issue, and signed out. */
    readonly reviewWriting: ReviewWriting | null;
    /** GitHub says there is no such item, or the user may not see it. */
    readonly missing: boolean;
    /** Its id could not be asked for: GitHub did not answer, for about half a minute, or refused. */
    readonly failed: boolean;
    /** None of its detail is on this device and GitHub did not give it: not reached, or refused (F16). */
    readonly detailFailed: boolean;
    /** Asks for its id again, after {@link failed}. */
    tryAgain(): void;
    /** Reads the comments not read yet; resolves once all are in, or GitHub stopped giving them, which is logged. */
    loadAllComments(): Promise<void>;
    /** Reads the reviews not read yet, the same way. */
    loadAllReviews(): Promise<void>;
    /**
     * Reads the middle of its thread — the events and the comments not read yet (F5's fold) — page by page; resolves
     * once all are in, rejects when GitHub does not give them, which is logged.
     */
    loadThreadMiddle(): Promise<void>;
    /** Reads its detail from GitHub again, after {@link detailFailed}; never rejects. */
    readDetailAgain(): Promise<void>;
}

/** What `loadPages` in {@link useOpenedItem} reads, page by page. */
interface LoadPagesParams {
    /** The item's id. */
    readonly id: string;
    /** Where the next page starts; `null` once all is read. */
    readonly readCursor: (id: string) => string | null;
    readonly loadPage: (id: string) => Promise<void>;
}

/**
 * Opens the item an address names: finds its id (`ItemResolver`), brings its detail into memory and has it read
 * again when its row moves on (`ItemDetailStore.ensure`), and remembers it as opened last (`ItemNavigation`), for
 * the list to select when the user comes back to it.
 */
export function useOpenedItem(options: UseOpenedItemOptions): OpenedItemViewModel {
    const resolver = useService(ItemResolver);
    const details = useService(ItemDetailStore);
    const items = useService(ItemStore);
    const navigation = useService(ItemNavigation);
    const reviewFiles = useService(ReviewFiles);
    const accounts = useService(AccountSession);
    const logger = useLogger();

    const reference = makeRef(options.reference);
    const found = computed(() => resolver.peek(reference.value));
    const id = computed(() => found.value ?? null);
    const item = computed(() => (id.value === null ? null : (details.getItem(id.value) ?? null)));
    const detail = computed(() => (id.value === null ? null : (details.get(id.value) ?? null)));
    const reviewModel = shallowRef<PullRequestFiles | null>(null);

    watch(
        reference,
        next => {
            if (resolver.peek(next) === undefined) {
                void resolver.resolve(next);
            }
        },
        { immediate: true },
    );

    // Opened, and its row moved on since (a poll read it again): its detail is read again.
    watch(
        () => [id.value, item.value?.updatedAt] as const,
        ([current]) => {
            if (current !== null) {
                navigation.setLastOpened(current);
                void details.ensure(current);
            }
        },
        { immediate: true },
    );

    // Opened, and its row left the local copy (it left "my work"): no poll reads it any more, and what made it leave —
    // merged on GitHub, say — is in neither the row nor the detail held. Its detail is read once more.
    watch(
        () => [id.value, id.value !== null && items.getStored(id.value) !== undefined] as const,
        ([current, held], [previous, heldBefore]) => {
            if (current !== null && current === previous && heldBefore && !held) {
                void details.readAgain(current);
            }
        },
    );

    // Opened, a pull request has its review threads read, from the disk at once and then GitHub — again only when it is
    // opened again, or by someone else signed in.
    watch(
        () =>
            [
                item.value?.kind === 'pullRequest' ? formatItemReference(getItemReference(item.value)) : null,
                accounts.current,
            ] as const,
        ([key]) => {
            const current = item.value;
            reviewModel.value = key !== null && current ? reviewFiles.openThreads(getItemReference(current)) : null;
        },
        { immediate: true },
    );

    return reactive<OpenedItemViewModel>({
        id,
        item,
        detail,
        reviewThreads: computed(() => reviewModel.value?.threads ?? []),
        reviewWriting: computed(() => reviewModel.value?.writing ?? null),
        missing: computed(() => found.value === null),
        failed: computed(() => found.value === undefined && resolver.hasFailed(reference.value)),
        detailFailed: computed(
            () => id.value !== null && detail.value === null && details.getFreshness(id.value).kind === 'stale',
        ),
        tryAgain: () => void resolver.resolve(reference.value),
        loadAllComments: () =>
            loadAllPages(current => details.get(current)?.comments.olderCursor ?? null, details.loadOlderComments),
        loadAllReviews: () =>
            loadAllPages(current => {
                const read = details.get(current);
                return read?.kind === 'pullRequest' ? read.olderReviewCursor : null;
            }, details.loadOlderReviews),
        loadThreadMiddle,
        readDetailAgain: () => (id.value === null ? Promise.resolve() : details.readAgain(id.value)),
    });

    async function loadThreadMiddle() {
        const current = id.value;
        if (current === null) {
            return;
        }

        try {
            await loadPages({ id: current, readCursor: readMiddleCursors, loadPage: details.loadThreadMiddle });
        } catch (error) {
            logger.warn("The middle of an item's thread could not be read", { id: current, error });
            throw error;
        }
    }

    /** Where the next page of the thread's middle starts, its events' and its comments' as one; `null` once all is read. */
    function readMiddleCursors(current: string) {
        const read = details.get(current);
        const events = read?.events.middle?.after ?? null;
        const comments = read?.comments.olderCursor ?? null;
        return events === null && comments === null ? null : `${events}|${comments}`;
    }

    async function loadAllPages(readCursor: (id: string) => string | null, loadPage: (id: string) => Promise<void>) {
        const current = id.value;
        if (current === null) {
            return;
        }

        try {
            await loadPages({ id: current, readCursor, loadPage });
        } catch (error) {
            logger.warn('Older comments or reviews could not be read', { id: current, error });
        }
    }

    async function loadPages({ id: current, readCursor, loadPage }: LoadPagesParams) {
        // A page at a time, until all is read — or the detail was read again meanwhile and the cursor did not move.
        let cursor = readCursor(current);
        while (cursor !== null) {
            await loadPage(current);
            const next = readCursor(current);
            cursor = next === cursor ? null : next;
        }
    }
}
