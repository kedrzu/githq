import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { toValue } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';

/** A list under a filter field that the keyboard moves through. */
export interface UseFilteredListKeysOptions {
    /** The element holding the rows; ↑/↓ move the focus while it is inside. */
    readonly container: MaybeRefOrGetter<HTMLElement | null>;
    /** What the focus moves between inside `container`: one element per row. */
    readonly rows: string;
    /** The filter field: ↑ from the first row goes back to it. */
    readonly filterField: MaybeRefOrGetter<{ focus(): void } | null>;
    /** The filter's text; Esc in the field clears it. */
    readonly filter: Ref<string>;
}

/** The keys of a filtered list, for the caller's own handlers. */
export interface FilteredListKeys {
    /** Whether a key event's target is inside the list. */
    isInside(target: EventTarget | null): boolean;
    /** The filter field's keys: Esc clears the filter, ↓ goes to the first row. */
    onFilterKeydown(event: KeyboardEvent): void;
}

/**
 * The keyboard of a list under a filter field (the tracking screens): ↑/↓ move the focus between the rows, ↑ from
 * the first back to the filter, ↓ from the filter to the first row; Esc in the filter clears it.
 * @util
 */
export function useFilteredListKeys(options: UseFilteredListKeysOptions): FilteredListKeys {
    const { rows, filter } = options;

    onWindowEvent('keydown', event => {
        if (
            !event.defaultPrevented &&
            (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
            isInside(event.target)
        ) {
            event.preventDefault();
            moveFocus(event.key === 'ArrowDown' ? 1 : -1, event.target);
        }
    });

    return { isInside, onFilterKeydown };

    function isInside(target: EventTarget | null) {
        return target instanceof Node && toValue(options.container)?.contains(target) === true;
    }

    function onFilterKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape' && filter.value !== '') {
            event.preventDefault();
            filter.value = '';
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveFocus(1, null);
        }
    }

    /** Moves the focus to the next or previous row; up from the first goes back to the filter. */
    function moveFocus(delta: 1 | -1, from: EventTarget | null) {
        const elements = [...(toValue(options.container)?.querySelectorAll<HTMLElement>(rows) ?? [])];
        const index = elements.findIndex(
            element => from instanceof Node && (element === from || element.contains(from)),
        );
        const next = index < 0 ? (delta === 1 ? 0 : -1) : index + delta;
        if (next < 0) {
            toValue(options.filterField)?.focus();
            return;
        }

        elements[Math.min(next, elements.length - 1)]?.focus();
    }
}
