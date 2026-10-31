import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, reactive, ref } from 'vue';

import { Browser } from '@/services/Browser.js';

/** What {@link usePanelWidth} keeps: a panel's width in pixels and the range the user may drag it in. */
export interface PanelWidthOptions {
    /** The panel's name in `localStorage`: `githq.panelWidth.<key>`. */
    readonly key: string;
    readonly default: number;
    readonly min: number;
    readonly max: number;
}

/**
 * The width of a panel the user resizes (a `SplitterPanel` sized in pixels), remembered in this browser for every
 * user. `stored` is what the user chose — the panel's `default-size`, which the splitter falls back to whenever its
 * panels change (one opens, the sidebar collapses), so it must always be the user's choice; `current` is the width
 * shown now — while dragging, or squeezed by a narrow window — for what follows the panel (the status bar's
 * segments). `save` keeps `current` once the user lets go of the handle, so a squeezed width is never remembered.
 *
 * `style` sizes the panel to `current` exactly: Reka sizes it by a `flex-grow` of its share of the group, rounded to
 * three digits — several pixels off on a wide window — and before it has laid the group out, by the pixels as if they
 * were a share. Reactive, for a template to read as it is.
 */
export function usePanelWidth(options: PanelWidthOptions) {
    const browser = useService(Browser);
    const storageKey = `githq.panelWidth.${options.key}`;

    const stored = ref(read());
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

            stored.value = width;
            browser.localStorage.setItem(storageKey, String(width));
        },
    });

    function read() {
        const width = Number(browser.localStorage.getItem(storageKey) ?? Number.NaN);
        return Number.isFinite(width) ? clamp(width) : options.default;
    }

    function clamp(width: number) {
        return Math.min(options.max, Math.max(options.min, width));
    }
}
