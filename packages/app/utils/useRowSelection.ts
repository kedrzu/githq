import type { Translation } from '@nzyme/i18n-core/Translation.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, nextTick, ref, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';

import { bindCommand } from '@/commands/bindCommand.js';
import type { CommandSection } from '@/commands/CommandTypes.js';
import * as definitions from '@/commands/definitions/index.js';
import { useCommands } from '@/commands/useCommands.js';

import { followSelection } from './followSelection.js';
import { takeFocusOffControl } from './takeFocusOffControl.js';

/** The places whose rows `next`, `previous` and `open` move through and open. */
export type RowSelectionPlace = (typeof definitions.next.places)[number];

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
    /** The place its keys are offered in (commands D13). */
    readonly place: RowSelectionPlace;
    /** The heading its keys sit under in the help sheet; `view` when not given. */
    readonly section?: CommandSection;
    /** What Enter does here, when it is more than "Open" ("Open failed run", "Edit the pattern"). */
    readonly openTitle?: Translation;
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
 * what they say; moving takes the focus off one, to the root if it can hold it), and a row gone moves it to its nearest
 * neighbour ({@link followSelection}). The keys are the `next`, `previous` and `open` commands, registered in `place`
 * while `enabled`, each acting on the row: not from what Tab focused outside the list.
 * @util
 */
export function useRowSelection<T>(options: UseRowSelectionOptions<T>): RowSelectionViewModel<T> {
    const t = useTranslate();
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

    useCommands(() => {
        const binding = {
            place: options.place,
            section: options.section ?? 'view',
            menu: false,
            actsOnRow: true,
            when: () => toValue(options.enabled) !== false,
        } as const;
        return [
            bindCommand(definitions.next, { ...binding, run: () => step(1) }, t),
            bindCommand(definitions.previous, { ...binding, run: () => step(-1) }, t),
            bindCommand(
                definitions.open,
                {
                    ...binding,
                    title: options.openTitle && t(options.openTitle),
                    when: () => binding.when() && selectedRow.value !== null,
                    run: () => {
                        if (selectedRow.value !== null) {
                            options.open(selectedRow.value);
                        }
                    },
                },
                t,
            ),
        ];
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
        takeFocusOffControl(toValue(options.root));

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
