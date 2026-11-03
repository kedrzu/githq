import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { storageRef } from '@nzyme/vue-utils/reactivity/storageRef.js';
import type { StorageRef } from '@nzyme/vue-utils/reactivity/storageRef.js';
import { effectScope } from 'vue';

import { ITEM_ARRANGEMENTS } from '@/item/itemRoutes.js';
import type { ItemArrangement } from '@/item/itemRoutes.js';

import { Browser } from './Browser.js';

const ITEM_ARRANGEMENT_KEY = 'githq.itemArrangement';
const SIDEBAR_COLLAPSED_KEY = 'githq.sidebarCollapsed';
const PANEL_WIDTH_KEY_PREFIX = 'githq.panelWidth.';
const PANEL_SHARE_KEY_PREFIX = 'githq.panelShare.';

/**
 * What this browser remembers of how the app is arranged, for every user of it and never sent to GitHub: the
 * arrangement items open in, whether the sidebar is collapsed and the widths the user dragged the panels to, in pixels or as a share of what holds them. The one
 * place that reads and writes those keys of `localStorage`; each is a ref saved as it changes, holding its default
 * while nothing valid is kept, and reloaded when another tab of the app changes it.
 *
 * The values are kept as plain strings (`panel`, `true`, `412`), as githq always kept them, so an arrangement chosen
 * before stays chosen.
 */
export type LocalPreferences = Resolved<typeof LocalPreferences>;
export const LocalPreferences = defineService({
    name: 'LocalPreferences',
    deps: {
        browser: Browser,
    },
    setup({ browser }) {
        const storage = browser.localStorage;

        const itemArrangement = storageRef<ItemArrangement>({
            key: ITEM_ARRANGEMENT_KEY,
            storage,
            default: () => 'panel',
            serialize: value => value,
            deserialize: raw => ITEM_ARRANGEMENTS.find(candidate => candidate === raw) ?? 'panel',
        });
        const sidebarCollapsed = storageRef<boolean>({
            key: SIDEBAR_COLLAPSED_KEY,
            storage,
            default: () => false,
            serialize: String,
            deserialize: raw => raw === 'true',
        });
        const panelSizes = new Map<string, StorageRef<number | null>>();
        // A panel's ref is made when first asked for, often in a component's setup: its own scope keeps it saving after
        // that component is gone (the item panel, once the item moves to the modal).
        const panelSizesScope = effectScope(true);

        browser.onLocalStorageChange(key => {
            if (key === null || key === ITEM_ARRANGEMENT_KEY) {
                itemArrangement.reload();
            }

            if (key === null || key === SIDEBAR_COLLAPSED_KEY) {
                sidebarCollapsed.reload();
            }

            for (const [panelKey, size] of panelSizes) {
                if (key === null || key === panelKey) {
                    size.reload();
                }
            }
        });

        return {
            /** The arrangement an item opens in — the one used last (D9). */
            itemArrangement,
            /** Whether the sidebar is collapsed to its icons. */
            sidebarCollapsed,
            getPanelWidth,
            getPanelShare,
        };

        /**
         * The width in pixels the user dragged the panel `panel` to (`githq.panelWidth.<panel>`); `null` while none is
         * kept. The same ref for every caller of one panel; its range is the caller's to keep.
         */
        function getPanelWidth(panel: string) {
            return getPanelSize(PANEL_WIDTH_KEY_PREFIX + panel, parseWidth);
        }

        /**
         * The share (above 0, up to 1) of what holds it that the user dragged the panel `panel` to
         * (`githq.panelShare.<panel>`), for a width that scales with the window; `null` while none is kept. The same
         * ref for every caller of one panel; fitting it to what can be drawn is the caller's.
         */
        function getPanelShare(panel: string) {
            return getPanelSize(PANEL_SHARE_KEY_PREFIX + panel, parseShare);
        }

        function getPanelSize(key: string, deserialize: (raw: string) => number | null) {
            let size = panelSizes.get(key);
            if (!size) {
                const created = panelSizesScope.run(() =>
                    storageRef<number | null>({ key, storage, serialize: String, deserialize }),
                );
                if (!created) {
                    throw new Error('The panel widths are no longer kept');
                }

                size = created;
                panelSizes.set(key, size);
            }

            return size;
        }
    },
});

function parseWidth(raw: string) {
    const width = Number(raw);
    return Number.isFinite(width) ? width : null;
}

function parseShare(raw: string) {
    const share = Number(raw);
    return share > 0 && share <= 1 ? share : null;
}
