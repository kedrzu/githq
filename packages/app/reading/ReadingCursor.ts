import { defineContext, injectContext, provideContext } from '@nzyme/vue-utils/context.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';

/**
 * Where a reading screen's cursor is: on the stop keyed so, so many pixels below its top. Held by key, not by
 * position, so a re-layout above it (a comment loading, an image) keeps it on its stop.
 */
export interface ReadingCursor {
    /** The stop's `data-reading-stop`. */
    readonly key: string;
    /** How far below the stop's top, in px: the cursor reads through a tall stop. */
    readonly offset: number;
}

/**
 * What a stop is (`data-reading-stop-kind`): a comment, which `[` `]` step between, or any other row (a commit, an
 * event, the fold), which only ↓ ↑ reach.
 */
export type ReadingStopKind = 'comment' | 'row';

/** A stop measured from the scroller's content top, in document order among the others. */
export interface ReadingStopBox {
    readonly key: string;
    readonly kind: ReadingStopKind;
    readonly top: number;
    readonly bottom: number;
}

/** The part of the content the reader sees, from the content's top: the scroller less what covers its edges. */
export interface ReadingBand {
    readonly top: number;
    readonly bottom: number;
}

/** What a stop is told: whether the cursor is on it. */
export interface ReadingStop {
    readonly current: boolean;
}

/** The cursor's stop, for the stops to mark themselves. */
interface ReadingCursorContext {
    currentKey(): string | null;
}

const ReadingCursorContext = defineContext<ReadingCursorContext>('ReadingCursorContext');

/** Lets the stops below know which of them the cursor is on (`useReadingStop`). */
export function provideReadingCursor(cursor: Readonly<Ref<ReadingCursor | null>>): void {
    provideContext(ReadingCursorContext, { currentKey: () => cursor.value?.key ?? null });
}

/**
 * Whether the reading cursor is on the stop keyed so. Never, where no screen provides a cursor (code review's
 * conversation shares the comment card and shows no marking).
 */
export function useReadingStop(key: MaybeRefOrGetter<string>): ReadingStop {
    const isCurrent = useReadingStops();
    return reactive<ReadingStop>({
        current: computed(() => isCurrent(toValue(key))),
    });
}

/**
 * Whether the reading cursor is on the stop keyed so, for a component drawing several stops in a loop (a push's
 * commits, a code thread's comments), where one `useReadingStop` each cannot be called. Reactive where it is read;
 * never, where no screen provides a cursor.
 */
export function useReadingStops(): (key: string) => boolean {
    const context = injectContext(ReadingCursorContext, { optional: true });
    return key => context !== null && context.currentKey() === key;
}

/**
 * Whether a screen above has a reading cursor now (an item's page), so the keys acting where it is work: a card's menu
 * shows them beside its entries (F31). Never in code review's conversation or an item's panel.
 */
export function useReadingCursorShown(): ComputedRef<boolean> {
    const context = injectContext(ReadingCursorContext, { optional: true });
    return computed(() => context !== null && context.currentKey() !== null);
}
