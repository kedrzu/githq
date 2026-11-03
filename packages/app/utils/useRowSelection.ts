import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, nextTick, ref, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';

import { followSelection } from './followSelection.js';
import { isActivatableTarget } from './isActivatableTarget.js';
import { isScreenKey } from './isScreenKey.js';

/** What every list of rows says, however its selected row is brought into sight. */
interface RowSelectionListOptions<T> {
    /** The rows, in the order the keys move through them. */
    readonly rows: MaybeRefOrGetter<readonly T[]>;
    /** What tells the rows apart, kept while the list changes under the selection. */
    getKey(row: T): string;
    /** Whether the first row is the selected one until the user moves; otherwise nothing is selected until then. */
    readonly selectFirst?: boolean;
    /**
     * The row the user moved to, for a screen that keeps it after it is gone; held here otherwise. One no longer listed
     * selects as if the user had not moved.
     */
    readonly chosenKey?: Ref<string | null>;
    /** Enter on the selected row. */
    open(row: T): void;
    /** Whether the keys are the list's now; always when not given. Something opened over it may take them. */
    readonly enabled?: MaybeRefOrGetter<boolean>;
}

/** A list with every row in the page: the selected one is found by its key and scrolled into sight. */
export interface UseRowSelectionDrawnOptions<T> extends RowSelectionListOptions<T> {
    /** The element holding the rows, scrolled so the selected one stays in sight. */
    readonly root: MaybeRefOrGetter<HTMLElement | null>;
    /** The attribute every row's element carries its key in (`data-workflow-key`). */
    readonly keyAttribute: string;
    readonly reveal?: undefined;
}

/** A virtual list, whose next row may not be drawn yet: only the list itself can bring it into sight. */
export interface UseRowSelectionVirtualOptions<T> extends RowSelectionListOptions<T> {
    /** Brings the row the keys moved to into sight. */
    reveal(key: string): void;
    readonly root?: undefined;
    readonly keyAttribute?: undefined;
}

/** A list of rows the screen's keys select in. */
export type UseRowSelectionOptions<T> = UseRowSelectionDrawnOptions<T> | UseRowSelectionVirtualOptions<T>;

/** The selection of a list the keys move through. */
export interface RowSelectionViewModel<T> {
    /** The selected row's key; `null` with nothing selected. */
    readonly selectedKey: string | null;
    /** The selected row; `null` with nothing selected. */
    readonly selectedRow: T | null;
    /** Selects a row, as the keys would (a click on it). */
    select(key: string): void;
    /** Scrolls the selected row into sight. */
    reveal(): void;
    /** Moves the selection by a row and brings it into sight, as the keys do (a button doing what they do). */
    step(by: 1 | -1): void;
}

/**
 * The selection of a screen's list of rows: J/K and ↓/↑ move it — from nothing selected, either way to the first
 * row — and bring the selected row into sight, Enter opens the selected row (not from a button or a link, which do
 * what they say, nor with Shift, a screen's own; moving takes the focus off one, to the root if it can hold it), and a row gone moves it to its nearest neighbour ({@link followSelection}). Keys only while the
 * screen has them ({@link isScreenKey}).
 * @util
 */
export function useRowSelection<T>(options: UseRowSelectionOptions<T>): RowSelectionViewModel<T> {
    /** The row the user moved to; `null` until they do. */
    const chosenKey = options.chosenKey ?? ref<string | null>(null);

    const keys = computed(() => toValue(options.rows).map(row => options.getKey(row)));
    const selectedKey = computed(() => {
        const chosen = chosenKey.value;
        if (!options.selectFirst) {
            return chosen;
        }

        return chosen !== null && keys.value.includes(chosen) ? chosen : (keys.value[0] ?? null);
    });
    const selectedRow = computed(
        () => toValue(options.rows).find(row => options.getKey(row) === selectedKey.value) ?? null,
    );

    watch(keys, (next, previous) => {
        chosenKey.value = followSelection(previous, next, chosenKey.value);
    });

    onWindowEvent('keydown', event => {
        if (!isScreenKey(event) || toValue(options.enabled) === false) {
            return;
        }

        switch (event.key) {
            case 'j':
            case 'ArrowDown':
                event.preventDefault();
                step(1);
                return;
            case 'k':
            case 'ArrowUp':
                event.preventDefault();
                step(-1);
                return;
            case 'Enter':
                if (!event.shiftKey && selectedRow.value !== null && !isActivatableTarget(event.target)) {
                    event.preventDefault();
                    options.open(selectedRow.value);
                }
        }
    });

    return reactive<RowSelectionViewModel<T>>({ selectedKey, selectedRow, select, reveal, step });

    function select(key: string) {
        chosenKey.value = key;
    }

    function step(by: 1 | -1) {
        const index = selectedKey.value === null ? -1 : keys.value.indexOf(selectedKey.value);
        const next =
            index === -1 ? keys.value[0] : keys.value[Math.min(Math.max(index + by, 0), keys.value.length - 1)];
        if (next === undefined) {
            return;
        }

        chosenKey.value = next;
        // A button clicked keeps the focus: moved off it, Enter is the selected row's again.
        if (isActivatableTarget(document.activeElement)) {
            toValue(options.root)?.focus({ preventScroll: true });
        }

        if (options.reveal) {
            options.reveal(next);
        } else {
            void nextTick(reveal);
        }
    }

    function reveal() {
        const key = selectedKey.value;
        if (key === null) {
            return;
        }

        if (options.reveal) {
            options.reveal(key);
        } else {
            toValue(options.root)
                ?.querySelector(`[${options.keyAttribute}="${CSS.escape(key)}"]`)
                ?.scrollIntoView({ block: 'nearest' });
        }
    }
}
