import { defineContext, injectContext, provideContext } from '@nzyme/vue-utils/context.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';

/**
 * A place in a reading screen's content: on the stop keyed so, so many pixels below its top. Held by key, not by
 * position, so a re-layout above it (a comment loading, an image) keeps it on its stop.
 */
export interface ReadingPlace {
    /** The stop's `data-reading-stop`. */
    readonly key: string;
    /** How far below the stop's top, in px: the cursor reads through a tall stop. */
    readonly offset: number;
}

/** Where a reading screen's cursor is, and which stops hold its own, for them to mark themselves as around it. */
export interface ReadingCursor extends ReadingPlace {
    /**
     * The keys of the cursor's stop and of every stop around it in the page, the cursor's own first, the outermost
     * last. Read from the page whenever the cursor is set or the content is drawn again (`useReadingCursor`).
     */
    readonly path: readonly string[];
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

/**
 * A stretch of the content the cursor stands on as one: the content cut at every stop's top and bottom, each piece
 * owned by the innermost stop holding it (`buildSegments`). A stop with stops nested in it may own several (a thread's
 * excerpt, then its bands after the comments), told apart by the cursor's offset.
 */
export interface ReadingSegment {
    /** The owning stop's `data-reading-stop`. */
    readonly key: string;
    readonly kind: ReadingStopKind;
    /** From the content's top. */
    readonly start: number;
    /** From the content's top, exclusive: the next segment's start. */
    readonly end: number;
}

/** The part of the content the reader sees, from the content's top: the scroller less what covers its edges. */
export interface ReadingBand {
    readonly top: number;
    readonly bottom: number;
}

/** What a stop is told: whether the cursor is on it, or on a stop inside it. */
export interface ReadingStop {
    readonly current: boolean;
    /** The cursor is on a stop inside this one (a comment of a code thread), not on this one. */
    readonly within: boolean;
}

/** Where a stop stands to the cursor: on it, around it (`within`), or neither. */
export type ReadingStopState = 'current' | 'within' | null;

/** The cursor, for the stops to mark themselves. */
interface ReadingCursorContext {
    cursor(): ReadingCursor | null;
}

const ReadingCursorContext = defineContext<ReadingCursorContext>('ReadingCursorContext');

/** Lets the stops below know which of them the cursor is on, or around (`useReadingStop`). */
export function provideReadingCursor(cursor: Readonly<Ref<ReadingCursor | null>>): void {
    provideContext(ReadingCursorContext, { cursor: () => cursor.value });
}

/**
 * Whether the reading cursor is on the stop keyed so, or on a stop inside it. Neither, where no screen provides a
 * cursor (code review's conversation shares the comment card and shows no marking).
 */
export function useReadingStop(key: MaybeRefOrGetter<string>): ReadingStop {
    const getState = useReadingStops();
    const state = computed(() => getState(toValue(key)));
    return reactive<ReadingStop>({
        current: computed(() => state.value === 'current'),
        within: computed(() => state.value === 'within'),
    });
}

/**
 * Where the stop keyed so stands to the reading cursor, for a component drawing several stops in a loop (a push's
 * commits, a code thread's comments), where one `useReadingStop` each cannot be called. Reactive where it is read;
 * `null`, where no screen provides a cursor.
 */
export function useReadingStops(): (key: string) => ReadingStopState {
    const context = injectContext(ReadingCursorContext, { optional: true });
    return key => {
        const cursor = context?.cursor() ?? null;
        if (cursor === null) {
            return null;
        }

        if (cursor.key === key) {
            return 'current';
        }

        return cursor.path.includes(key) ? 'within' : null;
    };
}

/**
 * Whether a screen above has a reading cursor now (an item's page), so the keys acting where it is work: a card's menu
 * shows them beside its entries (F31). Never in code review's conversation or an item's panel.
 */
export function useReadingCursorShown(): ComputedRef<boolean> {
    const context = injectContext(ReadingCursorContext, { optional: true });
    return computed(() => context !== null && context.cursor() !== null);
}
