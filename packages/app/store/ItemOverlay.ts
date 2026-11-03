import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import type { ProjectItem } from '@/projects/ProjectTypes.js';

import type { ItemDetail } from './ItemDetailTypes.js';
import type { MyWorkGroup } from './ItemStoreTypes.js';
import type { Item } from './ItemTypes.js';

/** A change drawn over an item as the stores hold it, until GitHub's copy has caught up with it. */
export interface ItemOverlayLayer {
    /** The item's row with the change. */
    readonly item: (item: Item) => Item;
    /** The item's detail with the change, beyond its row (a comment, a project field's value). */
    readonly detail?: (detail: ItemDetail) => ItemDetail;
    /**
     * Whether a row as stored is newer than the change, so the layer no longer applies to it (or to a detail read
     * with it). Without it the layer applies to whatever comes in — a change GitHub has not confirmed yet.
     */
    readonly supersededBy?: (stored: Item) => boolean;
    /**
     * GitHub's time of a confirmed change: the row and detail it is written into remember it (`Item.confirmation`),
     * so that a copy read before it does not replace them in any tab.
     */
    readonly confirmedAt?: string;
    /** The item's place in a tracked project with the change (a field's value, a draft's title). */
    readonly projectItem?: (item: ProjectItem) => ProjectItem;
    /** Whether a project item as stored is newer than the change; without it the change applies to any. */
    readonly projectItemSupersededBy?: (stored: ProjectItem) => boolean;
    /**
     * The project items the change adds (a draft issue, a new issue's places): shown in their projects until the
     * projects hold them.
     */
    readonly addedProjectItems?: readonly ProjectItem[];
    /** An issue the change creates: shown wherever it belongs until the item store holds it. */
    readonly addedItem?: AddedItem;
}

/** An issue being created, as the lists show it before (and for a while after) the item store holds it. */
export interface AddedItem {
    /** Under a temporary id until GitHub answers, then GitHub's issue. */
    readonly item: Item;
    /** The group of "my work" it shows in (assigned to the user), until the next sync finds it there. */
    readonly myWorkGroup: MyWorkGroup | null;
}

/**
 * The user's own changes drawn over the items in memory (D8): the stores apply the layers of an item every time
 * it is read, so a change shows at once in every row, item view, project view and count, and stays over whatever
 * a sync brings in meanwhile. Layers are kept by the item's id — a draft issue's by its project item id. Nothing
 * here is kept: the layers live only as long as the edits behind them.
 */
export type ItemOverlay = Resolved<typeof ItemOverlay>;
export const ItemOverlay = defineService({
    name: 'ItemOverlay',
    setup() {
        const layersRef = shallowRef<ReadonlyMap<string, readonly ItemOverlayLayer[]>>(new Map());

        return {
            /** Whether any item has layers; reactive. */
            get empty() {
                return layersRef.value.size === 0;
            },
            add,
            replace,
            remove,
            clear,
            applyToItem,
            applyToDetail,
            applyToProjectItem,
            getAddedProjectItems,
            getAddedItems,
            getConfirmedId,
        };

        /** Draws `layer` over the item, over the layers before it. */
        function add(id: string, layer: ItemOverlayLayer) {
            const next = new Map(layersRef.value);
            next.set(id, [...(next.get(id) ?? []), layer]);
            layersRef.value = next;
        }

        /**
         * Puts `by` where `layer` is: below the layers drawn after it, which may still change the same values. Adds it
         * over the rest when `layer` is gone.
         */
        function replace(id: string, layer: ItemOverlayLayer, by: ItemOverlayLayer) {
            const layers = layersRef.value.get(id) ?? [];
            const replaced = layers.includes(layer)
                ? layers.map(other => (other === layer ? by : other))
                : [...layers, by];
            layersRef.value = new Map([...layersRef.value, [id, replaced]]);
        }

        function remove(id: string, layer: ItemOverlayLayer) {
            const layers = layersRef.value.get(id);
            if (!layers?.includes(layer)) {
                return;
            }

            const next = new Map(layersRef.value);
            const left = layers.filter(other => other !== layer);
            if (left.length > 0) {
                next.set(id, left);
            } else {
                next.delete(id);
            }

            layersRef.value = next;
        }

        function clear() {
            layersRef.value = new Map();
        }

        /** The row with the item's layers drawn over it; the row itself when it has none. Reactive. */
        function applyToItem(item: Item): Item {
            const layers = layersRef.value.get(item.id);
            if (!layers) {
                return item;
            }

            let result = item;
            for (const layer of layers) {
                if (!layer.supersededBy?.(item)) {
                    result = layer.item(result);
                }
            }

            return result;
        }

        /** The detail, and the row in it, with the item's layers drawn over them. Reactive. */
        function applyToDetail(detail: ItemDetail): ItemDetail {
            const layers = layersRef.value.get(detail.id);
            if (!layers) {
                return detail;
            }

            let result = detail;
            for (const layer of layers) {
                if (!layer.supersededBy?.(detail.item)) {
                    result = applyLayerToDetail(layer, result);
                }
            }

            return result;
        }

        /** The project item with the layers of its issue, pull request or draft drawn over it. Reactive. */
        function applyToProjectItem(item: ProjectItem): ProjectItem {
            const layers = layersRef.value.get(item.contentId ?? item.itemId);
            if (!layers) {
                return item;
            }

            let result = item;
            for (const layer of layers) {
                if (layer.projectItem && !layer.projectItemSupersededBy?.(item)) {
                    result = layer.projectItem(result);
                }
            }

            return result;
        }

        /** The items the user's changes on their way add to the project (draft issues). Reactive. */
        function getAddedProjectItems(projectId: string): ProjectItem[] {
            const added: ProjectItem[] = [];
            for (const layers of layersRef.value.values()) {
                for (const layer of layers) {
                    for (const item of layer.addedProjectItems ?? []) {
                        if (item.projectId === projectId) {
                            added.push(item);
                        }
                    }
                }
            }

            return added;
        }

        /** The issues the user's changes create, the newest last. Reactive. */
        function getAddedItems(): AddedItem[] {
            const added: AddedItem[] = [];
            for (const layers of layersRef.value.values()) {
                for (const layer of layers) {
                    if (layer.addedItem) {
                        added.push(layer.addedItem);
                    }
                }
            }

            return added;
        }

        /**
         * The id GitHub gave an issue created under a temporary one, once it answered (for a while after); `null`
         * before, or for any other id. A selection holding the temporary id follows it. Reactive.
         */
        function getConfirmedId(temporaryId: string): string | null {
            for (const layer of layersRef.value.get(temporaryId) ?? []) {
                const id = layer.addedItem?.item.id;
                if (id !== undefined && id !== temporaryId) {
                    return id;
                }
            }

            return null;
        }
    },
});

/**
 * The detail with one layer drawn over it and over the row in it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function applyLayerToDetail(layer: ItemOverlayLayer, detail: ItemDetail): ItemDetail {
    const changed = { ...detail, item: layer.item(detail.item) };
    return layer.detail ? layer.detail(changed) : changed;
}
