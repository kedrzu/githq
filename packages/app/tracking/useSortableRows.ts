import { assert } from '@nzyme/utils/assert.js';
import { toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import type { DraggableEvent } from 'vue-draggable-plus';

/** How far the pointer goes before a press on a row is a drag, not a click, in px. */
const DRAG_TOLERANCE = 4;
/** How long the other rows take to make room for the dragged one, in ms, while animating. */
const DRAG_ANIMATION = 150;

/** Where a dragged row lands: right before or after another row of its list. */
export interface SortablePlace<T> {
    readonly anchor: T;
    readonly side: 'before' | 'after';
}

/** A list of rows the user orders by dragging (D44). */
export interface UseSortableRowsOptions<T> {
    /** The other rows make room by sliding: the app's animations on, and no reduced motion asked for. */
    readonly animate: MaybeRefOrGetter<boolean>;
    /** The dragged row's own place in the list while its copy moves under the pointer. */
    readonly ghostClass: string;
    /** The copy moving under the pointer, on `<body>`, out of the list: it takes the list's look along. */
    readonly floatingClass: string;
    /** A row dropped elsewhere, told against the rows as given. */
    move(row: T, place: SortablePlace<T>): void;
}

/** What a `VueDraggable` holding the rows is bound to (`v-bind`). */
export interface SortableRowsBinding<T> {
    readonly forceFallback: true;
    readonly fallbackOnBody: true;
    readonly fallbackTolerance: number;
    readonly animation: number;
    readonly ghostClass: string;
    readonly fallbackClass: string;
    readonly customUpdate: (event: DraggableEvent<T>) => void;
    readonly onStart: () => void;
    readonly onEnd: () => void;
    readonly onClickCapture: (event: MouseEvent) => void;
}

/** A sortable list's drag handling. */
export interface SortableRowsViewModel<T> {
    /** The `VueDraggable` bindings of the list `list` (one name per list the component draws) showing `rows`, in their order. */
    bind(list: string, rows: readonly T[]): SortableRowsBinding<T>;
}

/**
 * Ordering a list by dragging its rows with `vue-draggable-plus` (D44), as the sidebar and Settings' tracked lists do:
 * the row moves under the pointer (Sortable's own pointer dragging, its copy on `<body>`) and the others make room. On
 * a drop Sortable's moved element goes back where Vue put it, for Vue alone to change the list once the new order comes
 * back through the rows; the move is told against the rows as given — down, right after the row it took the place of;
 * up, right before it. The click the browser sends on release is swallowed, so a drag doesn't open the dragged row.
 * @util
 */
export function useSortableRows<T>(options: UseSortableRowsOptions<T>): SortableRowsViewModel<T> {
    /** A row is being dragged, until just after its release. */
    let dragging = false;
    /**
     * Each list's rows as last drawn. `VueDraggable` reads `customUpdate` once, as it mounts, so the handler it keeps
     * must read the rows of now, not the ones it was bound with: after a first drop they are in another order.
     */
    const rowsByList = new Map<string, readonly T[]>();

    return { bind };

    function bind(list: string, rows: readonly T[]): SortableRowsBinding<T> {
        rowsByList.set(list, rows);
        return {
            forceFallback: true,
            fallbackOnBody: true,
            fallbackTolerance: DRAG_TOLERANCE,
            animation: toValue(options.animate) ? DRAG_ANIMATION : 0,
            ghostClass: options.ghostClass,
            fallbackClass: options.floatingClass,
            customUpdate: event => moveDropped(rowsByList.get(list) ?? [], event),
            onStart: startDrag,
            onEnd: endDrag,
            onClickCapture: swallowClickAfterDrag,
        };
    }

    function moveDropped(rows: readonly T[], event: DraggableEvent<T>) {
        const { from, item, oldIndex, newIndex } = event;
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
            return;
        }

        item.remove();
        const next = from.children[oldIndex];
        if (next) {
            next.before(item);
        } else {
            // It was the last row: after the last one now, not after the end of Vue's own nodes.
            const last = from.children[from.children.length - 1];
            assert(last);
            last.after(item);
        }

        const row = rows[oldIndex];
        const anchor = rows[newIndex];
        assert(row !== undefined && anchor !== undefined);
        options.move(row, { anchor, side: newIndex > oldIndex ? 'after' : 'before' });
    }

    function startDrag() {
        dragging = true;
    }

    /** The click the browser sends on release comes before a timeout does: the drag ends after it. */
    function endDrag() {
        setTimeout(() => {
            dragging = false;
        });
    }

    function swallowClickAfterDrag(event: MouseEvent) {
        if (dragging) {
            event.preventDefault();
            event.stopPropagation();
        }
    }
}
