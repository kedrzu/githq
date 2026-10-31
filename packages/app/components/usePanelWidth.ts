import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, reactive, ref } from 'vue';

import { LocalPreferences } from '@/services/LocalPreferences.js';

/** What {@link usePanelWidth} keeps: a panel's width in pixels and the range the user may drag it in. */
export interface PanelWidthOptions {
    /** The panel's name among the widths {@link LocalPreferences} keeps. */
    readonly key: string;
    readonly default: number;
    readonly min: number;
    readonly max: number;
}

/**
 * The width of a panel the user resizes (a `SplitterPanel` sized in pixels), remembered in this browser for every
 * user ({@link LocalPreferences}) and kept within the range given here. `stored` is what the user chose — the panel's
 * `default-size`, which the splitter falls back to whenever its panels change (one opens, the sidebar collapses), so
 * it must always be the user's choice; `current` is the width
 * shown now — while dragging, or squeezed by a narrow window — for what follows the panel (the status bar's
 * segments). `save` keeps `current` once the user lets go of the handle, so a squeezed width is never remembered.
 *
 * `style` sizes the panel to `current` exactly: Reka sizes it by a `flex-grow` of its share of the group, rounded to
 * three digits — several pixels off on a wide window — and before it has laid the group out, by the pixels as if they
 * were a share. Reactive, for a template to read as it is.
 */
export function usePanelWidth(options: PanelWidthOptions) {
    const kept = useService(LocalPreferences).getPanelWidth(options.key);

    const stored = computed(() => (kept.value === null ? options.default : clamp(kept.value)));
    const current = ref(stored.value);
    const style = computed(() => ({ flexGrow: 0, flexShrink: 0, flexBasis: `${current.value}px` }));

    return reactive({
        stored,
        current,
        style,
        min: options.min,
        max: options.max,
        save() {
            const width = clamp(Math.round(current.value));
            if (width === stored.value) {
                return;
            }

            kept.value = width;
        },
    });

    function clamp(width: number) {
        return Math.min(options.max, Math.max(options.min, width));
    }
}
