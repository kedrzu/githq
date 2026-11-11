import { shallowRef, watch } from 'vue';
import type { ShallowRef } from 'vue';

/** Fewer typed characters ask GitHub nothing. */
const MIN_LENGTH = 2;

/** How long what is typed must stay as it is before GitHub is asked. */
const SEARCH_DELAY_MS = 300;

/** Where a search of GitHub stands for what is typed now. */
export type GitHubSearch<T> =
    | { readonly kind: 'tooShort' }
    | { readonly kind: 'asking' }
    | { readonly kind: 'failed' }
    | { readonly kind: 'answered'; readonly result: T };

/** What {@link useGitHubSearch} sends, and how. */
export interface UseGitHubSearchOptions<T> {
    /** What is typed now, trimmed. */
    readonly text: () => string;
    /**
     * How to ask GitHub now; `null` while nothing may be asked (signed out). Read anew on every change it depends on,
     * so another account drops what was asked for the one before.
     */
    readonly ask: () => ((text: string) => Promise<T>) | null;
    /** Fewer typed characters ask GitHub nothing; 2 by default. */
    readonly minLength?: number;
}

/**
 * Typing that asks GitHub (D34, E8; mobile D34, G18): from two typed characters (or `minLength`), once typing pauses. Latest wins: a
 * change cancels the wait, and what was asked before it is dropped when it answers.
 * @util
 */
export function useGitHubSearch<T>(options: UseGitHubSearchOptions<T>): Readonly<ShallowRef<GitHubSearch<T>>> {
    const state = shallowRef<GitHubSearch<T>>({ kind: 'tooShort' });
    const minLength = options.minLength ?? MIN_LENGTH;

    // Synchronous, so nothing can answer between the change and the older question being dropped.
    watch(
        [options.text, options.ask],
        ([text, ask], _before, onCleanup) => {
            if (!ask || text.length < minLength) {
                state.value = { kind: 'tooShort' };
                return;
            }

            state.value = { kind: 'asking' };
            let stale = false;
            const timer = setTimeout(() => void answer(ask, text, () => stale), SEARCH_DELAY_MS);
            onCleanup(() => {
                stale = true;
                clearTimeout(timer);
            });
        },
        { flush: 'sync', immediate: true },
    );

    return state;

    async function answer(ask: (text: string) => Promise<T>, text: string, isStale: () => boolean) {
        const answered = await ask(text).then(
            (result): GitHubSearch<T> => ({ kind: 'answered', result }),
            (): GitHubSearch<T> => ({ kind: 'failed' }),
        );
        if (!isStale()) {
            state.value = answered;
        }
    }
}
