import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, ref } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import type { MaxWidth } from '@/settings/sync/SettingsDocument.js';

/** Dragged this close to the room's edge, the box takes all of it. */
const FULL_SNAP = 8;

/** What {@link useMaxWidth} draws a box from, and where it keeps what the user chooses. */
export interface UseMaxWidthOptions {
    /** The maximum the user chose, `null` for {@link UseMaxWidthOptions.default}. */
    readonly saved: MaybeRefOrGetter<MaxWidth | null>;
    /** Keeps the maximum the user dragged the box to. */
    save(width: MaxWidth): void;
    readonly default: MaxWidth;
    /** The narrowest the box is drawn, even wider than the room. */
    readonly min: number;
    /** The width there is for the box, measured. */
    readonly room: MaybeRefOrGetter<number>;
}

/** A centred box drawn at most as wide as the user chose, as {@link useMaxWidth} gives it. */
export interface MaxWidthViewModel {
    /** `WidthHandle`'s model: the dragged width while dragging, else the maximum, `'full'` being the room. */
    current: number;
    /** The width to draw the box at, in whole pixels: the maximum within the room, never below the minimum. */
    readonly shown: number;
    /** Keeps what the user dragged the box to (`WidthHandle`'s `resized`); nothing when they changed nothing. */
    save(): void;
}

/**
 * The width of a centred box resized by its edges (`WidthHandle`), the user's choice being a maximum: the box is drawn
 * at it while there is room, narrower in a narrower room and back at it once the room grows again — so only the user's
 * drag or arrow key writes it, never a change of the room. Dragged to the room's edge, the choice is `'full'`: as wide
 * as there is room, whatever the window. A change of `saved` (from another device) redraws the box.
 */
export function useMaxWidth(options: UseMaxWidthOptions): MaxWidthViewModel {
    const saved = makeRef(options.saved);
    const room = makeRef(options.room);
    /** The width the user dragged the box to since the last save, `null` while they changed nothing. */
    const dragged = ref<number | null>(null);

    const maximum = computed(() => {
        const width = saved.value ?? options.default;
        return width === 'full' ? room.value : width;
    });
    const current = computed({
        get: () => dragged.value ?? maximum.value,
        set: width => {
            // A press or a move that leaves the box as it is drawn changes nothing: a click on the edge saves nothing.
            if (dragged.value === null && width === shown.value) {
                return;
            }

            dragged.value = width;
        },
    });
    const shown = computed(() => Math.round(Math.max(options.min, Math.min(current.value, room.value))));

    return reactive<MaxWidthViewModel>({ current, shown, save });

    function save() {
        const width = dragged.value;
        if (width === null) {
            return;
        }

        dragged.value = null;
        const next: MaxWidth = width >= room.value - FULL_SNAP ? 'full' : Math.round(width);
        if (next !== saved.value) {
            options.save(next);
        }
    }
}
