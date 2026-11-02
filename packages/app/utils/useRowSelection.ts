import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, nextTick, ref, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';

import { followSelection } from './followSelection.js';
import { isActivatableTarget } from './isActivatableTarget.js';
import { isScreenKey } from './isScreenKey.js';

/** A list of rows the screen's keys select in. */
export interface UseRowSelectionOptions<T> {
    /** The rows, in the order the keys move through them. */
    readonly rows: MaybeRefOrGetter<readonly T[]>;
    /** What tells the rows apart, kept while the list changes under the selection. */
    getKey(row: T): string;
    /** The element holding the rows, scrolled so the selected one stays in sight. */
    readonly root: MaybeRefOrGetter<HTMLElement | null>;
    /** The attribute every row's element carries its key in (`data-workflow-key`). */
    readonly keyAttribute: string;
    /** Whether the first row is the selected one until the user moves; otherwise nothing is selected until then. */
    readonly selectFirst?: boolean;
    /**
     * The row the user moved to, for a screen that keeps it after it is gone; held here otherwise. One no longer listed
     * selects as if the user had not moved.
     */
    readonly chosenKey?: Ref<string | null>;
    /** Enter on the selected row. */
    open(row: T): void;
}

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
}

/**
 * The selection of a screen's list of rows: J/K and ↓/↑ move it — from nothing selected, either way to the first
 * row — and scroll the selected row into sight, Enter opens the selected row (not from a button or a link, which do
 * what they say), and a row gone moves it to its nearest neighbour ({@link followSelection}). Keys only while the
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
        if (!isScreenKey(event)) {
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
                if (selectedRow.value !== null && !isActivatableTarget(event.target)) {
                    event.preventDefault();
                    options.open(selectedRow.value);
                }
        }
    });

    return reactive<RowSelectionViewModel<T>>({ selectedKey, selectedRow, select, reveal });

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
        void nextTick(reveal);
    }

    function reveal() {
        if (selectedKey.value !== null) {
            toValue(options.root)
                ?.querySelector(`[${options.keyAttribute}="${CSS.escape(selectedKey.value)}"]`)
                ?.scrollIntoView({ block: 'nearest' });
        }
    }
}
