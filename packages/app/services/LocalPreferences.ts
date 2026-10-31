import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { storageRef } from '@nzyme/vue-utils/reactivity/storageRef.js';
import type { StorageRef } from '@nzyme/vue-utils/reactivity/storageRef.js';

import { ITEM_ARRANGEMENTS } from '@/item/itemRoutes.js';
import type { ItemArrangement } from '@/item/itemRoutes.js';

import { Browser } from './Browser.js';

const ITEM_ARRANGEMENT_KEY = 'githq.itemArrangement';
const SIDEBAR_COLLAPSED_KEY = 'githq.sidebarCollapsed';
const PANEL_WIDTH_KEY_PREFIX = 'githq.panelWidth.';

/**
 * What this browser remembers of how the app is arranged, for every user of it and never sent to GitHub: the
 * arrangement items open in, whether the sidebar is collapsed and the widths the user dragged the panels to. The one
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
        const panelWidths = new Map<string, StorageRef<number | null>>();

        browser.onLocalStorageChange(key => {
            if (key === null || key === ITEM_ARRANGEMENT_KEY) {
                itemArrangement.reload();
            }

            if (key === null || key === SIDEBAR_COLLAPSED_KEY) {
                sidebarCollapsed.reload();
            }

            for (const [panel, width] of panelWidths) {
                if (key === null || key === PANEL_WIDTH_KEY_PREFIX + panel) {
                    width.reload();
                }
            }
        });

        return {
            /** The arrangement an item opens in — the one used last (D9). */
            itemArrangement,
            /** Whether the sidebar is collapsed to its icons. */
            sidebarCollapsed,
            getPanelWidth,
        };

        /**
         * The width in pixels the user dragged the panel `panel` to (`githq.panelWidth.<panel>`); `null` while none is
         * kept. The same ref for every caller of one panel; its range is the caller's to keep.
         */
        function getPanelWidth(panel: string) {
            let width = panelWidths.get(panel);
            if (!width) {
                width = storageRef<number | null>({
                    key: PANEL_WIDTH_KEY_PREFIX + panel,
                    storage,
                    serialize: String,
                    deserialize: parseWidth,
                });
                panelWidths.set(panel, width);
            }

            return width;
        }
    },
});

function parseWidth(raw: string) {
    const width = Number(raw);
    return Number.isFinite(width) ? width : null;
}
